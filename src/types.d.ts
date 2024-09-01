export type Requests = Map<
  string,
  (isSuccessful: boolean, response: ProxiedRequestResponse) => void
>;

export type ProxiedRequestResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};
