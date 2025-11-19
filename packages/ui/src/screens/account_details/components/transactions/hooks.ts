import { useRouter } from 'next/router';
import * as R from 'ramda';
import { useEffect, useRef, useState } from 'react';
import { convertMsgsToModels } from '@/components/msg/utils';
import {
  GetMessagesByAddressQuery,
  Order_By,
  useGetTransactionsByAddressRegexQuery,
} from '@/graphql/types/general_types';
import type { TransactionState } from '@/screens/account_details/components/transactions/types';
import { convertMsgType } from '@/utils/convert_msg_type';
import { useRecoilValue } from 'recoil';
import { readFilter } from '@/recoil/transactions_filter';
import chainConfig from '@/chainConfig';

const LIMIT = 50;

export const getAddressPubKeyRegex = async (address: string) => {
  const response = await fetch(`${chainConfig().restApiUrl}/accounts/${address}`);

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  const data = (await response.json()) as {
    account: {
      '@type': string;
      base_account: {
        address: string;
        pub_key: {
          '@type': string;
          key: string;
        };
        account_number: string;
        sequence: string;
      };
      code_hash: string;
    };
  };

  const escapedString = data.account.base_account.pub_key.key.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
  const regex = new RegExp(escapedString).toString();
  return regex.substring(1, regex.length - 1);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const formatTransactions = (data: GetMessagesByAddressQuery): Transactions[] => {
  let formattedData = data.messagesByAddress;
  if (data.messagesByAddress.length === 51) {
    formattedData = data.messagesByAddress.slice(0, 51);
  }
  return formattedData.map((x) => {
    const { transaction } = x;

    // =============================
    // messages
    // =============================
    const messages = convertMsgsToModels(transaction);
    const msgType = messages.map((eachMsg) => {
      const eachMsgType = eachMsg?.type ?? 'none type';
      return eachMsgType ?? '';
    });
    const convertedMsgType = convertMsgType(msgType);
    return {
      height: transaction?.height,
      hash: transaction?.hash ?? '',
      type: convertedMsgType,
      messages: {
        count: messages.length,
        items: messages,
      },
      success: transaction?.success ?? false,
      timestamp: transaction?.block.timestamp,
    };
  });
};

export function useTransactions(addressRegex: string) {
  const router = useRouter();
  const [state, setState] = useState<TransactionState>({
    data: [],
    hasNextPage: false,
    isNextPageLoading: true,
    offsetCount: 0,
  });
  const msgTypes = useRecoilValue(readFilter);
  const isFirst = useRef(true);

  // reset state when address changes
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
    } else {
      setState((prevState) => ({
        ...prevState,
        data: [],
        hasNextPage: false,
        isNextPageLoading: true,
        offsetCount: 0,
      }));
    }
  }, [router?.query?.address, msgTypes]);

  const handleSetState = (stateChange: (prevState: TransactionState) => TransactionState) => {
    setState((prevState) => {
      const newState = stateChange(prevState);
      return R.equals(prevState, newState) ? prevState : newState;
    });
  };

  const { fetchMore } = useGetTransactionsByAddressRegexQuery({
    variables: {
      limit: LIMIT + 1, // to check if more exist
      offset: 0,
      // address: `{${router?.query?.address ?? ''}}`,
      _regex: addressRegex,
      // types: msgTypes,
      order_by: [{ height: Order_By.Desc }],
    },
    onCompleted: (data) => {
      const itemsLength = data.transaction.length;
      const newItems = R.uniq([...state.data, ...data.transaction]);
      const stateChange: TransactionState = {
        data: newItems as Transactions[],
        hasNextPage: itemsLength === 51,
        isNextPageLoading: false,
        offsetCount: state.offsetCount + LIMIT,
      };

      handleSetState((prevState) => ({ ...prevState, ...stateChange }));
    },
  });

  const loadNextPage = async () => {
    handleSetState((prevState) => ({ ...prevState, isNextPageLoading: true }));
    // refetch query
    await fetchMore({
      variables: {
        offset: state.offsetCount,
        limit: LIMIT + 1,
      },
    }).then(({ data }) => {
      const itemsLength = data.transaction.length;
      const newItems = R.uniq([...state.data, ...data.transaction]);
      const stateChange: TransactionState = {
        data: newItems as Transactions[],
        hasNextPage: itemsLength === 51,
        isNextPageLoading: false,
        offsetCount: state.offsetCount + LIMIT,
      };
      handleSetState((prevState) => ({ ...prevState, ...stateChange }));
    });
  };

  return {
    state,
    loadNextPage,
  };
}
