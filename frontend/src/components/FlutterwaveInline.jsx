import { useEffect, useRef } from 'react'

const SCRIPT_SRC = 'https://checkout.flutterwave.com/v3.js'

export default function FlutterwaveInline({ payment, onSuccess, onClose, onError }) {
  const openedRef = useRef(false)

  useEffect(() => {
    if (!payment || openedRef.current) return
    openedRef.current = true

    const open = () => {
      if (typeof window.FlutterwaveCheckout !== 'function') {
        onError?.('Unable to load the payment service. Please try again.')
        return
      }

      window.FlutterwaveCheckout({
        public_key: payment.publicKey,
        tx_ref: payment.reference,
        amount: payment.amount,
        currency: payment.currency,
        payment_options: payment.paymentOptions || 'card, banktransfer, ussd',
        customer: payment.customer,
        customizations: {
          title: 'Keanu Reeves Fan Community',
          description: 'Add funds to your community balance',
        },
        payload_hash: payment.payloadHash,
        callback: (result) => {
          if (String(result?.status).toLowerCase() !== 'successful' || !result?.transaction_id) {
            onError?.('Transaction failed. Your balance has not been changed.')
            return
          }
          onSuccess?.(result)
        },
        onclose: (incomplete) => {
          if (incomplete) onClose?.(true)
          else onClose?.(false)
        },
      })
    }

    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      open()
      return undefined
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = open
    script.onerror = () => onError?.('Unable to load the payment service. Please try again.')
    document.body.appendChild(script)

    return undefined
  }, [payment, onSuccess, onClose, onError])

  return null
}
