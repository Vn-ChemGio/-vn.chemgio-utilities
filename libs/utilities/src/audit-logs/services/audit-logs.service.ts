import { HttpService } from '@nestjs/axios';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import PangeaResponse from '../utils/response';
import {
  canonicalizeEvent,
  eventOrderAndStringifySubfields,
} from '../utils/utils';
import {
  PublishedRoots,
  verifyLogConsistencyProof,
  verifyLogHash,
  verifyLogMembershipProof,
  verifyRecordConsistencyProof,
  verifyRecordMembershipProof,
  verifySignature,
} from '../utils/verification';

@Injectable()
export class AuditLogsService {
  protected prevUnpublishedRootHash?: string;
  private publishedRoots: PublishedRoots;

  constructor(
    @Inject(REQUEST) private request: Request,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.publishedRoots = {};
    this.prevUnpublishedRootHash = undefined;
  }

  /**
   * @summary Log an entry
   * @description Create a log entry in the Secure Audit Log.
   * @operationId audit_post_v1_log
   * @param {Audit.Event} event A structured event describing an auditable activity. Supported fields are:
   *   - action (string): The auditable action that occurred.
   *   - status (string): Record whether or not the activity was successful.
   *   - source (string): Used to record the location from where an activity occurred.
   *   - target (string): Used to record the specific record that was targeted by the auditable activity.
   *   - message (string|object): A message describing a detailed account of what happened.
   *     This can be recorded as free-form text or as a JSON-formatted string.
   *   - new (string|object): The value of a record after it was changed.
   *   - old (string|object): The value of a record before it was changed.
   * @param {Audit.LogOptions} options Log options. The following log options are supported:
   *   - verbose (bool): Return a verbose response, including the canonical event hash and received_at time.
   * @param {Function} callback a function to process when error
   * @returns A promise representing an async call to the /v1/log endpoint.
   * @example
   * constructor(
   *    private readonly auditLogsService: AuditLogsService,
   * )
   * const auditData = {
   *   action: "add_employee",
   *   status: "COMPLETED",
   *   source: "web",
   *   target: data.email,
   *   message: `Resume denied - sanctioned country from ${clientIp}`,
   * };
   * const options = { verbose: true };
   *
   * const response = await this.auditLogsService.log(auditData, options);
   */
  public async log(
    event: Audit.EventData,
    options: Audit.LogOptions = {},
    callback: { (error: Error): void } = () => {},
  ) {
    const data = this.getLogEvent(event, options);
    this.setRequestFields(data, options);

    return this.httpService
      .post('v1/log', data)
      .toPromise()
      .then((response) => response.data)
      .then((response) => {
        this.processLogResponse(response.result, options);
        return response;
      })
      .catch(callback);
  }

  /**
   * @summary Log multiple entries
   * @description Create multiple log entries in the Secure Audit Log.
   * @operationId audit_post_v2_log
   * @param {Audit.Event[]} events
   * @param {Audit.LogOptions} options
   * @param {Function} callback a function to process when error
   * @returns {Promise} - A promise representing an async call to the /v2/log endpoint.
   * @example
   * constructor(
   *    private readonly auditLogsService: AuditLogsService,
   * )
   * const events = [
   *  { message: "hello world" },
   * ];
   * const options = { verbose: true };
   *
   * const response = await this.auditLogsService.logBulk(events, options);
   */
  public async logBulk(
    events: Audit.Event[],
    options: Audit.LogOptions = {},
    callback: { (error: Error): void } = () => {},
  ): Promise<PangeaResponse<Audit.LogBulkResponse>> {
    if (!events.length) {
      return {
        result: { results: [] },
      } as PangeaResponse<Audit.LogBulkResponse>;
    }

    const logEvents: Audit.LogEvent[] = [];
    events.forEach((event) => {
      logEvents.push(this.getLogEvent(event, options));
    });

    const data: Audit.LogBulkRequest = {
      events: logEvents,
      verbose: options.verbose,
      config_id: this.configService.get('AUDIT_LOG_CONFIG_ID'),
    };

    options.verify = false; // Bulk API does not verify
    return this.httpService
      .post('v2/log', data)
      .toPromise()
      .then((result) => result.data)
      .then((response) => {
        response.result.results.forEach((result) => {
          this.processLogResponse(result, options);
        });
        return response;
      })
      .catch(callback);
  }

  private getLogEvent(
    event: Audit.Event,
    options: Audit.LogOptions,
  ): Audit.LogData {
    event.tenant_id = this.request.user?.organizationId;
    event.actor = this.request.user?.id;

    const ip =
      this.request.headers['x-forwarded-for'] ||
      this.request.connection?.remoteAddress;
    const method = this.request.headers['method'];
    const userAgent = this.request.headers['user-agent'];
    event.source = JSON.stringify({
      ip,
      method,
      userAgent,
    });
    event.service_name = this.configService.get('AUDIT_LOG_SERVICE_NAME');
    event = eventOrderAndStringifySubfields(event);
    const data: Audit.LogData = {
      event: event,
      config_id: this.configService.get('AUDIT_LOG_CONFIG_ID'),
    };

    if (options.signer) {
      const signer = options.signer;
      const signature = signer.sign(canonicalizeEvent(event));
      const pubKey = signer.getPublicKey();
      const algorithm = signer.getAlgorithm();

      const publicKeyInfo: { [key: string]: any } = {};
      if (options.publicKeyInfo) {
        Object.assign(publicKeyInfo, options.publicKeyInfo);
      }
      publicKeyInfo['key'] = pubKey;
      publicKeyInfo['algorithm'] = algorithm;

      data.signature = signature;
      data.public_key = JSON.stringify(publicKeyInfo);
    }

    return data;
  }

  private setRequestFields(data: Audit.LogData, options: Audit.LogOptions) {
    if (options?.verbose) {
      data.verbose = options.verbose;
    }

    if (options?.verify) {
      data.verbose = true;
      if (this.prevUnpublishedRootHash != undefined) {
        data.prev_root = this.prevUnpublishedRootHash;
      }
    }
  }

  private processLogResponse(
    result: Audit.LogResponse,
    options: Audit.LogOptions,
  ) {
    const newUnpublishedRootHash = result.unpublished_root;

    if (!options?.skipEventVerification) {
      this.verifyHash(result.envelope, result.hash);
      result.signature_verification = verifySignature(result.envelope);
    }

    if (options?.verify) {
      result.membership_verification = verifyLogMembershipProof({
        log: result,
        newUnpublishedRootHash: newUnpublishedRootHash,
      });

      result.consistency_verification = verifyLogConsistencyProof({
        log: result,
        newUnpublishedRoot: newUnpublishedRootHash,
        prevUnpublishedRoot: this.prevUnpublishedRootHash,
      });
    }

    if (newUnpublishedRootHash !== undefined) {
      this.prevUnpublishedRootHash = newUnpublishedRootHash;
    }
  }

  private verifyHash(
    envelope: Audit.EventEnvelope | undefined,
    hash: string | undefined,
  ): void {
    if (envelope === undefined || hash === undefined) {
      return;
    }

    if (!verifyLogHash(envelope, hash)) {
      throw new InternalServerErrorException(
        'Error: Fail event hash verification. Hash: ' + hash,
        JSON.stringify(envelope),
      );
    }
  }

  /**
   * @summary Search the log
   * @description Search for events that match the provided search criteria.
   * @operationId audit_post_v1_search
   * @param {String} query - Natural search string; list of keywords with optional
   *   `<option>:<value>` qualifiers. The following optional qualifiers are supported:
   *   - action:
   *   - actor:
   *   - message:
   *   - new:
   *   - old:
   *   - status:
   *   - target:
   * @param {Audit.SearchParamsOptions} queryOptions - Search options. The following search options are supported:
   * @param {Object} options - Search options. The following search options are supported:
   *   - limit (number): Maximum number of records to return per page.
   *   - start (string): The start of the time range to perform the search on.
   *   - end (string): The end of the time range to perform the search on. All records up to the latest if left out.
   *   - sources (array): A list of sources that the search can apply to. If empty or not provided, matches only the default source.
   * @returns {Promise} - A promise representing an async call to the search endpoint
   * @example
   * ```js
   * const response = await audit.search(
   *   "add_employee:Gumby"
   * );
   * ```
   */
  async search(
    query: string,
    queryOptions: Audit.SearchParamsOptions,
    options: Audit.SearchOptions,
  ): Promise<PangeaResponse<Audit.SearchResponse>> {
    const defaults: Audit.SearchParamsOptions = {
      limit: 20,
      order: 'desc',
      order_by: 'received_at',
      config_id: this.configService.get('AUDIT_LOG_CONFIG_ID'),
    };

    const payload: Audit.SearchParams = { query };
    Object.assign(payload, defaults);
    Object.assign(payload, queryOptions);

    if (options?.verifyConsistency) {
      payload.verbose = true;
    }
    console.log(payload);
    const response: PangeaResponse<Audit.SearchResponse> =
      await this.httpService
        .post('v1/search', payload)
        .toPromise()
        .then((result) => result.data);
    console.log(response);
    return this.processSearchResponse(response, options);
  }

  /**
   * @summary Results of a search
   * @description Fetch paginated results of a previously executed search.
   * @operationId audit_post_v1_results
   * @param {String} id - The id of a successful search
   * @param {number} limit (default 20) - The number of results returned
   * @param {number} offset (default 0) - The starting position of the first returned result
   * @param {Audit.SearchOptions} options - Verify consistency and membership proof of every record
   * @returns {Promise} - A promise representing an async call to the results endpoint
   * @example
   * ```js
   * const response = await audit.results(
   *   "pas_sqilrhruwu54uggihqj3aie24wrctakr",
   *   50,
   *   100
   * );
   * ```
   */
  async results(
    id: string,
    limit = 20,
    offset = 0,
    options: Audit.SearchOptions,
  ): Promise<PangeaResponse<Audit.ResultResponse>> {
    if (!id) {
      throw new Error('Missing required `id` parameter');
    }

    const payload = {
      id,
      limit,
      offset,
    };

    const response: PangeaResponse<Audit.SearchResponse> =
      await this.httpService
        .post('v1/results', payload)
        .toPromise()
        .then((result) => result.data);
    return this.processSearchResponse(response, options);
  }

  /**
   * @summary Log streaming endpoint
   * @description This API allows 3rd party vendors (like Auth0) to stream
   * events to this endpoint where the structure of the payload varies across
   * different vendors.
   * @operationId audit_post_v1_log_stream
   * @param data Event data. The exact schema of this will vary by vendor.
   * @returns A Pangea response.
   * @example
   * ```js
   * const data = {
   *   logs: [
   *     {
   *       log_id: "some log id",
   *       data: {
   *         date: "2024-03-29T17:26:50.193Z",
   *         type: "some_type",
   *         description: "Create a log stream",
   *         client_id: "test client ID",
   *         ip: "127.0.0.1",
   *         user_agent: "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0",
   *         user_id: "test user ID",
   *       },
   *     },
   *   ],
   * };
   * const response = await audit.logStream(data);
   * ```
   */
  public async logStream(
    data: object,
  ): Promise<PangeaResponse<NonNullable<unknown>>> {
    return this.httpService
      .post('v1/log_stream', data)
      .toPromise()
      .then((result) => result.data);
  }

  /**
   * @summary Tamperproof verification
   * @description Returns current root hash and consistency proof.
   * @operationId audit_post_v1_root
   * @param {number} size - The size of the tree (the number of records)
   * @returns {Promise} - A promise representing an async call to the endpoint
   * @example
   * ```js
   * const response = audit.root(7);
   * ```
   */
  async root(size: number = 0): Promise<PangeaResponse<Audit.RootResult>> {
    const data: Audit.RootParams = {};

    if (size > 0) {
      data.tree_size = size;
    }

    return this.httpService
      .post('v1/root', data)
      .toPromise()
      .then((result) => result.data);
  }

  /**
   * @summary Download search results
   * @description Get all search results as a compressed (gzip) CSV file.
   * @operationId audit_post_v1_download_results
   * @param request Request parameters.
   * @returns URL where search results can be downloaded.
   * @example
   * ```js
   * const response = await audit.downloadResults({
   *   result_id: "pas_[...]",
   *   format: Audit.DownloadFormat.CSV,
   * });
   * ```
   */
  downloadResults(
    request: Audit.DownloadRequest,
  ): Promise<PangeaResponse<Audit.DownloadResult>> {
    return this.httpService
      .post('v1/download_results', request)
      .toPromise()
      .then((result) => result.data);
  }

  async processSearchResponse(
    response: PangeaResponse<Audit.SearchResponse>,
    options: Audit.SearchOptions,
  ): Promise<PangeaResponse<Audit.SearchResponse>> {
    if (!response.success) {
      return response;
    }

    const localRoot = async (treeSize: number) => {
      const response = await this.root(treeSize);
      const root: Audit.Root = response.result.data;
      return root;
    };

    if (!options?.skipEventVerification) {
      response.result.events.forEach((record: Audit.AuditRecord) => {
        this.verifyHash(record.envelope, record.hash);
        record.signature_verification = verifySignature(record.envelope);
      });
    }

    if (options?.verifyConsistency) {
      const root = response.result.root;
      if (root !== undefined) {
        const treeName = root?.tree_name;
        const treeSizes = new Set<number>();
        treeSizes.add(root?.size ?? 0);

        response.result.events.forEach((record: Audit.AuditRecord) => {
          if (record.leaf_index !== undefined) {
            const idx = Number(record.leaf_index);
            treeSizes.add(idx + 1);
            if (idx > 0) {
              treeSizes.add(idx);
            }
          }
        });

        this.publishedRoots = await this.getArweavePublishedRoots(
          treeName,
          Array.from(treeSizes),
          localRoot,
        );
      }

      response.result.events.forEach((record: Audit.AuditRecord) => {
        record.membership_verification = verifyRecordMembershipProof({
          root: record.published ? root : response.result.unpublished_root,
          record: record,
        });

        record.consistency_verification = verifyRecordConsistencyProof({
          publishedRoots: this.publishedRoots,
          record: record,
        });
      });
    }
    return response;
  }

  private async getArweavePublishedRoots(
    treeName: string,
    treeSizes: number[],
    fetchRoot: (treeSize: number) => Promise<Audit.Root>,
  ): Promise<PublishedRoots> {
    if (!treeSizes.length) return {};

    const ARWEAVE_BASE_URL = 'https://arweave.net';
    const ARWEAVE_GRAPHQL_URL = `${ARWEAVE_BASE_URL}/graphql`;

    const arweaveTransactionUrl = (transactionId: string): string => {
      return `${ARWEAVE_BASE_URL}/${transactionId}/`;
    };

    const query = `
{
    transactions(
        tags: [
            {
                name: "tree_size"
                values: [${treeSizes.map((size) => `"${size}"`).join(', ')}]
            },
            {
                name: "tree_name"
                values: ["${treeName}"]
            }
        ]
    ) {
        edges {
            node {
                id
                tags {
                    name
                    value
                }
            }
        }
    }
}
    `;

    const response = await this.httpService
      .post(ARWEAVE_GRAPHQL_URL, { query })
      .toPromise()
      .then((result) => result.data);

    const publishedRoots: PublishedRoots = {};
    const body: any = response.body as JSON;
    const edges = body?.data?.transactions?.edges ?? [];

    for (let idx = 0; idx < edges.length; idx++) {
      const edge = edges[idx];

      const nodeId = edge?.node?.id;
      const tags = edge?.node?.tags ?? [];

      const treeSizeTags = tags.filter((tag: any) => tag?.name === 'tree_size');

      if (!treeSizeTags.length) continue;

      const treeSize = treeSizeTags[0]?.value;
      const transactionUrl = arweaveTransactionUrl(nodeId);

      const response = await this.httpService
        .post(transactionUrl)
        .toPromise()
        .then((result) => result.data);

      publishedRoots[treeSize] = {
        ...JSON.parse(response),
        transactionId: nodeId,
      };
    }

    for (let idx = 0; idx < treeSizes.length; idx++) {
      const treeSize = treeSizes[idx];

      if (treeSize && !(treeSize in publishedRoots)) {
        const root = await fetchRoot(treeSize).catch((err) => {
          console.log('Failed to fetch server roots', err);
        });

        if (root) {
          publishedRoots[treeSize] = {
            ...root,
          };
        }
      }
    }

    return publishedRoots;
  }
}
