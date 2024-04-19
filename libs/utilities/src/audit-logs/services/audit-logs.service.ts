import { REQUEST } from '@nestjs/core';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import PangeaResponse from '../utils/response';
import {
  canonicalizeEvent,
  eventOrderAndStringifySubfields,
} from '../utils/utils';
import {
  verifyLogConsistencyProof,
  verifyLogHash,
  verifyLogMembershipProof,
  verifySignature,
} from '../utils/verification';

@Injectable()
export class AuditLogsService {
  protected prevUnpublishedRootHash?: string;

  constructor(
    @Inject(REQUEST) private request: Request,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.prevUnpublishedRootHash = undefined;
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

  processLogResponse(result: Audit.LogResponse, options: Audit.LogOptions) {
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

  verifyHash(
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
   * @summary Log an entry
   * @description Create a log entry in the Secure Audit Log.
   * @operationId audit_post_v1_log
   * @param event A structured event describing an auditable activity. Supported fields are:
   *   - actor (string): Record who performed the auditable activity.
   *   - action (string): The auditable action that occurred.
   *   - status (string): Record whether or not the activity was successful.
   *   - source (string): Used to record the location from where an activity occurred.
   *   - target (string): Used to record the specific record that was targeted by the auditable activity.
   *   - message (string|object): A message describing a detailed account of what happened.
   *     This can be recorded as free-form text or as a JSON-formatted string.
   *   - new (string|object): The value of a record after it was changed.
   *   - old (string|object): The value of a record before it was changed.
   *   - tenant_id (string): Used to record the tenant associated with this activity.
   * @param options Log options. The following log options are supported:
   *   - verbose (bool): Return a verbose response, including the canonical event hash and received_at time.
   * @returns A promise representing an async call to the /v1/log endpoint.
   * @example
   * ```js
   * const auditData = {
   *   action: "add_employee",
   *   actor: user,
   *   target: data.email,
   *   status: "error",
   *   message: `Resume denied - sanctioned country from ${clientIp}`,
   *   source: "web",
   * };
   * const options = { verbose: true };
   *
   * const response = await audit.log(auditData, options);
   * ```
   */
  public async log(event: Audit.Event, options: Audit.LogOptions = {}) {
    const data = this.getLogEvent(event, options) as Audit.LogData;
    this.setRequestFields(data, options);

    const response: PangeaResponse<Audit.LogResponse> = await this.httpService
      .post('v1/log', data)
      .toPromise()
      .then((response) => response.data);

    this.processLogResponse(response.result, options);
    return response;
  }

  /**
   * @summary Log multiple entries
   * @description Create multiple log entries in the Secure Audit Log.
   * @operationId audit_post_v2_log
   * @param {Audit.Event[]} events
   * @param {Audit.LogOptions} options
   * @returns {Promise} - A promise representing an async call to the /v2/log endpoint.
   * @example
   * ```js
   * const events = [
   *  { message: "hello world" },
   * ];
   * const options = { verbose: true };
   *
   * const response = await audit.logBulk(events, options);
   * ```
   */
  async logBulk(
    events: Audit.Event[],
    options: Audit.LogOptions = {},
  ): Promise<PangeaResponse<Audit.LogBulkResponse>> {
    const logEvents: Audit.LogEvent[] = [];
    events.forEach((event) => {
      logEvents.push(this.getLogEvent(event, options));
    });

    const data: Audit.LogBulkRequest = {
      events: logEvents,
      verbose: options.verbose,
    };

    options.verify = false; // Bulk API does not verify
    const response: PangeaResponse<Audit.LogBulkResponse> =
      await this.httpService
        .post('v2/log', data)
        .toPromise()
        .then((result) => result.data);

    response.result.results.forEach((result) => {
      this.processLogResponse(result, options);
    });
    return response;
  }
}
