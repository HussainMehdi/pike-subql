import { Account, AccountCToken, AccountCTokenTransaction } from "../types/models"

export let zeroBD = BigInt(0)
export let mantissaFactorBD: BigInt = BigInt(1e18)

export async function createAccount(accountID: string): Promise<Account> {
  let account = new Account(accountID)
  account.countLiquidated = 0
  account.countLiquidator = 0
  account.hasBorrowed = false
  await account.save()
  return account
}

export async function updateCommonCTokenStats(
  marketID: string,
  marketSymbol: string,
  accountID: string,
  tx_hash: string,
  timestamp: BigInt,
  blockNumber: number,
  logIndex: number,
): Promise<AccountCToken> {
  let cTokenStatsID = marketID.concat('-').concat(accountID)
  let cTokenStats = await AccountCToken.get(cTokenStatsID)
  if (cTokenStats == null) {
    cTokenStats = createAccountCToken(cTokenStatsID, marketSymbol, accountID, marketID)
  }
  await getOrCreateAccountCTokenTransaction(
    cTokenStatsID,
    tx_hash,
    timestamp,
    blockNumber,
    logIndex,
  )
  cTokenStats.accrualBlockNumber = BigInt(+blockNumber);
  return cTokenStats as AccountCToken
}

export function createAccountCToken(
  cTokenStatsID: string,
  symbol: string,
  account: string,
  marketID: string,
): AccountCToken {
  let cTokenStats = new AccountCToken(cTokenStatsID)
  cTokenStats.symbol = symbol
  cTokenStats.marketId = marketID
  cTokenStats.accountId = account
  cTokenStats.accrualBlockNumber = BigInt(0)
  cTokenStats.cTokenBalance = zeroBD
  cTokenStats.totalUnderlyingSupplied = zeroBD
  cTokenStats.totalUnderlyingRedeemed = zeroBD
  cTokenStats.accountBorrowIndex = zeroBD
  cTokenStats.totalUnderlyingBorrowed = zeroBD
  cTokenStats.totalUnderlyingRepaid = zeroBD
  cTokenStats.storedBorrowBalance = zeroBD
  cTokenStats.enteredMarket = false
  return cTokenStats
}


export async function getOrCreateAccountCTokenTransaction(
  accountID: string,
  tx_hash: string,
  timestamp: BigInt,
  block: number,
  logIndex: number,
): Promise<AccountCTokenTransaction> {
  let id = accountID
    .concat('-')
    .concat(tx_hash)
    .concat('-')
    .concat(logIndex.toString())
  let transaction = await AccountCTokenTransaction.get(id)

  if (transaction == undefined) {
    transaction = new AccountCTokenTransaction(id)
    transaction.accountId = accountID
    transaction.tx_hash = tx_hash
    transaction.timestamp = BigInt(+timestamp)
    transaction.block = BigInt(+block)
    transaction.logIndex = BigInt(+logIndex)
    await transaction.save()
  }

  return transaction as AccountCTokenTransaction
}