declare global {
  type Request = {
    user?: {
      id?: string;
      organizationId?: string;
    };
  };
}
