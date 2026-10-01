export type WealthReaderAccess = {
  token: string;
  entityCode: string;
};

export type WealthReaderBalance = {
  available?: string | number | null;
  current?: string | number | null;
};

export type WealthReaderTransaction = {
  id?: string;
  uuid?: string;
  date?: string;
  booking_date?: string;
  value_date?: string;
  amount?: string | number;
  currency?: string;
  description?: string;
  name?: string;
  counterpart?: string;
  counterparty?: string;
  status?: string;
};

export type WealthReaderAccount = {
  uuid?: string;
  code?: string;
  name?: string;
  currency?: string;
  subtype?: string;
  balances?: WealthReaderBalance;
  transactions?: WealthReaderTransaction[];
};

export type WealthReaderPayload = {
  success?: boolean;
  payload?: {
    accounts?: WealthReaderAccount[];
  };
  accounts?: WealthReaderAccount[];
  statistics?: {
    token?: string;
    code?: string;
  };
};
