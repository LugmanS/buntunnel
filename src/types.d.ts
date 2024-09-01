export type Requests = Map<string, (response: ProxiedRequestResponse) => void>;

export type ProxiedRequestResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};
