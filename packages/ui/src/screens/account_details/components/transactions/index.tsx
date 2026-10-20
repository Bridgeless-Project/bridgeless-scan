import Typography from '@mui/material/Typography';
import useAppTranslation from '@/hooks/useAppTranslation';
import { FC, useEffect, useState } from 'react';
import { useRecoilValue, SetterOrUpdater, useRecoilState } from 'recoil';
import Box from '@/components/box';
import TransactionsList from '@/components/transactions_list';
import TransactionsListDetails from '@/components/transactions_list_details';
import { readTx } from '@/recoil/settings';
import { writeFilter, writeSelectedMsgTypes } from '@/recoil/transactions_filter';
import { getAddressPubKeyRegex, useTransactions } from '@/screens/account_details/components/transactions/hooks';
import useStyles from '@/screens/account_details/components/transactions/styles';
import { useRouter } from 'next/router';

const Transactions: FC<ComponentDefault> = (props) => {
  const router = useRouter();

  const [addressRegex, setAddressRegex] = useState<string | null>();

  useEffect(() => {
    if (addressRegex !== undefined) return;

    const init = async () => {
      setAddressRegex(await getAddressPubKeyRegex(router?.query?.address as string));
    }

    init();

  }, [addressRegex, router?.query?.address])

  if (addressRegex === undefined) return null;

  return (
    <TransactionsContent {...props} addressRegex={addressRegex} />
  )

}

const TransactionsContent: FC<ComponentDefault & {
  addressRegex: string | null
}> = (props) => {
  const txListFormat = useRecoilValue(readTx);
  const { classes, cx } = useStyles();
  const { t } = useAppTranslation('validators');

  const { state, loadNextPage } = useTransactions(props.addressRegex);

  const loadMoreItems = state.isNextPageLoading ? () => null : loadNextPage;
  const isItemLoaded = (index: number) => !state.hasNextPage || index < state.data.length;
  const itemCount = state.hasNextPage ? state.data.length + 1 : state.data.length;
  const [, setMsgTypes] = useRecoilState(writeFilter) as [string, SetterOrUpdater<string>];
  const [, setSelectedMsgs] = useRecoilState(writeSelectedMsgTypes) as [
    string[],
    SetterOrUpdater<string[]>,
  ];
  useEffect(() => {
    setMsgTypes('{}');
    setSelectedMsgs([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box className={cx(classes.root, props.className)}>
      <Typography variant="h2">{t('transactions')}</Typography>
      <div className={classes.list}>
        {txListFormat === 'compact' ? (
          <TransactionsList
            transactions={state.data}
            itemCount={itemCount}
            hasNextPage={state.hasNextPage}
            isNextPageLoading={state.isNextPageLoading}
            loadNextPage={loadNextPage}
            loadMoreItems={loadMoreItems}
            isItemLoaded={isItemLoaded}
          />
        ) : (
          <TransactionsListDetails
            transactions={state.data}
            itemCount={itemCount}
            hasNextPage={state.hasNextPage}
            isNextPageLoading={state.isNextPageLoading}
            loadNextPage={loadNextPage}
            loadMoreItems={loadMoreItems}
            isItemLoaded={isItemLoaded}
          />
        )}
      </div>
    </Box>
  );
};

export default Transactions;
