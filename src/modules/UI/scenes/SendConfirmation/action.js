// @flow
import { Actions } from 'react-native-router-flux'
import type { Dispatch, GetState } from '../../../ReduxTypes'
import { openABAlert } from '../../components/ABAlert/action'
import { OPEN_AB_ALERT } from '../../../../constants/indexConstants'
import { getWallet } from '../../../Core/selectors.js'
import { getSelectedWalletId } from '../../selectors.js'
import { type AbcMakeSpendInfo, getTransaction, getSpendInfo } from './selectors'
import {
  getMaxSpendable,
  signTransaction,
  broadcastTransaction,
  saveTransaction,
  makeSpend
} from '../../../Core/Wallets/api.js'
import type {
  AbcParsedUri,
  AbcTransaction
} from 'airbitz-core-types'

const PREFIX = 'UI/SendConfimation/'

export const UPDATE_LABEL = PREFIX + 'UPDATE_LABEL'
export const UPDATE_IS_KEYBOARD_VISIBLE = PREFIX + 'UPDATE_IS_KEYBOARD_VISIBLE'
export const UPDATE_SPEND_PENDING = PREFIX + 'UPDATE_SPEND_PENDING'
export const RESET = PREFIX + 'RESET'
export const UPDATE_PARSED_URI = PREFIX + 'UPDATE_PARSED_URI'
export const UPDATE_TRANSACTION = PREFIX + 'UPDATE_TRANSACTION'

export const createTX = (parsedUri: AbcMakeSpendInfo | AbcParsedUri) =>
  (dispatch: Dispatch, getState: GetState) => {
    const state = getState()
    const walletId = getSelectedWalletId(state)
    const abcWallet = getWallet(state, walletId)
    const parsedUriClone = { ...parsedUri }
    const spendInfo = getSpendInfo(state, parsedUriClone)
    makeSpend(abcWallet, spendInfo)
    .then(abcTransaction => {
      dispatch(updateTransaction(abcTransaction, null))
      dispatch(makeParsedURI(parsedUriClone))
    })
    .catch(e => dispatch(updateTransaction(null, e)))
  }

export const updateMaxSpend = () => (dispatch: Dispatch, getState: GetState) => {
  const state = getState()
  const walletId = getSelectedWalletId(state)
  const abcWallet = getWallet(state, walletId)
  const spendInfo = getSpendInfo(state)
  getMaxSpendable(abcWallet, spendInfo)
  .then(nativeAmount => {
    const amount: AbcParsedUri = { nativeAmount }
    dispatch(createTX(amount))
  })
  .catch(e => console.log(e))
}

export const signBroadcastAndSave = () => (dispatch: Dispatch, getState: GetState) => {
  const state = getState()
  const selectedWalletId = getSelectedWalletId(state)
  const wallet = getWallet(state, selectedWalletId)
  const abcUnsignedTransaction = getTransaction(state)

  dispatch(updateSpendPending(true))

  signTransaction(wallet, abcUnsignedTransaction)
    .then((abcSignedTransaction: AbcTransaction) => broadcastTransaction(wallet, abcSignedTransaction))
    .then((abcSignedTransaction: AbcTransaction) => saveTransaction(wallet, abcSignedTransaction))
    .then(() => {
      dispatch(updateSpendPending(false))
      Actions.pop()
      const successInfo = {
        success: true,
        title: 'Transaction Sent',
        message: 'Your transaction has been successfully sent.'
      }
      dispatch(openABAlert(OPEN_AB_ALERT, successInfo))
    })
    .catch((e) => {
      dispatch(updateSpendPending(false))
      const errorInfo = {
        success: false,
        title: 'Transaction Failure',
        message: e.message
      }
      dispatch(openABAlert(OPEN_AB_ALERT, errorInfo))
    })
}

export const updateLabel = (label: string) => ({
  type: UPDATE_LABEL,
  data: {label}
})

export const reset = () => ({
  type: RESET,
  data: {}
})

export const makeParsedURI = (parsedUri: AbcParsedUri) => ({
  type: UPDATE_PARSED_URI,
  data: { parsedUri }
})

export const updateTransaction = (transaction: ?AbcTransaction, error: ?Error) => ({
  type: UPDATE_TRANSACTION,
  data: { transaction, error }
})

export const updateSpendPending = (pending: boolean) => ({
  type: UPDATE_SPEND_PENDING,
  data: {pending}
})

export {
  createTX as updateParsedURI,
  createTX as updateMiningFees
}
