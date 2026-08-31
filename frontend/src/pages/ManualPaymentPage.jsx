import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/payment.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const money = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount || 0) / 100);

export default function ManualPaymentPage() {
  const { token } = useAuth();
  const { token: paymentToken } = useParams();
  const navigate = useNavigate();

  const [payment, setPayment] = useState(null);
  const [options, setOptions] = useState({ cryptoOptions: [], giftCardOptions: [] });
  const [method, setMethod] = useState('');
  const [crypto, setCrypto] = useState('');
  const [network, setNetwork] = useState('');
  const [giftCard, setGiftCard] = useState('');
  const [selectionSaved, setSelectionSaved] = useState(false);
  const [selectionSaving, setSelectionSaving] = useState(false);
  const [proof, setProof] = useState('');
  const [proofName, setProofName] = useState('');
  const [proofType, setProofType] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [paymentResponse, optionsResponse] = await Promise.all([
        fetch(`${API}/payments/mine/${encodeURIComponent(paymentToken)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/payment-config/options`),
      ]);

      const paymentData = await paymentResponse.json();
      const optionsData = await optionsResponse.json();

      if (!paymentResponse.ok || !paymentData.success) {
        throw new Error(paymentData.message || 'Unable to load payment request.');
      }

      if (cancelled) return;
      setPayment(paymentData.payment);

      if (optionsData.success) {
        setOptions({
          cryptoOptions: optionsData.cryptoOptions || [],
          giftCardOptions: optionsData.giftCardOptions || [],
        });
      }

      if (paymentData.payment?.paymentMethod === 'CRYPTO') {
        setMethod('CRYPTO');
        setCrypto(paymentData.payment.crypto?.currency || '');
        setNetwork(paymentData.payment.crypto?.network || '');
        setSelectionSaved(Boolean(paymentData.payment.crypto?.currency && paymentData.payment.crypto?.network));
      } else if (paymentData.payment?.paymentMethod === 'GIFTCARD') {
        setMethod('GIFTCARD');
        setGiftCard(paymentData.payment.giftCard?.brand || '');
        setSelectionSaved(Boolean(paymentData.payment.giftCard?.brand));
      }
    };

    load()
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [paymentToken, token]);

  const chooseProof = (event) => {
    const file = event.target.files?.[0];
    setError('');
    setProof('');
    setProofName('');
    setProofType('');

    if (!file) return;
    if (!ALLOWED_PROOF_TYPES.includes(file.type)) {
      setError('Payment proof must be a JPG, PNG, WEBP image or PDF receipt.');
      return;
    }
    if (file.size > MAX_PROOF_BYTES) {
      setError('Payment proof is too large. Maximum size is 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProof(String(reader.result || ''));
      setProofName(file.name);
      setProofType(file.type);
    };
    reader.onerror = () => setError('Unable to read the selected proof file. Please try again.');
    reader.readAsDataURL(file);
  };

  const clearProof = () => {
    setProof('');
    setProofName('');
    setProofType('');
  };

  const savePaymentSelection = async ({ nextMethod, nextCrypto = '', nextNetwork = '', nextGiftCard = '' }) => {
    setSelectionSaving(true);
    setSelectionSaved(false);
    setError('');

    try {
      const response = await fetch(`${API}/payments/mine/${encodeURIComponent(paymentToken)}/method`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentMethod: nextMethod,
          cryptoCurrency: nextMethod === 'CRYPTO' ? nextCrypto : undefined,
          cryptoNetwork: nextMethod === 'CRYPTO' ? nextNetwork : undefined,
          giftCardBrand: nextMethod === 'GIFTCARD' ? nextGiftCard : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to save payment method.');

      setPayment(data.payment);
      setSelectionSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSelectionSaving(false);
    }
  };

  const chooseCrypto = (option) => {
    setMethod('CRYPTO');
    setGiftCard('');
    setCrypto(option.currency);
    setNetwork(option.network);
    savePaymentSelection({ nextMethod: 'CRYPTO', nextCrypto: option.currency, nextNetwork: option.network });
  };

  const chooseGiftCard = (option) => {
    setMethod('GIFTCARD');
    setCrypto('');
    setNetwork('');
    setGiftCard(option.brand);
    savePaymentSelection({ nextMethod: 'GIFTCARD', nextGiftCard: option.brand });
  };

  const selectedCrypto = options.cryptoOptions.find(
    (option) => option.currency === crypto && option.network === network,
  );
  const selectedGiftCard = options.giftCardOptions.find((option) => option.brand === giftCard);
  const hasCrypto = options.cryptoOptions.length > 0;
  const hasGiftCards = options.giftCardOptions.length > 0;
  const hasMethods = hasCrypto || hasGiftCards;
  const selectionReady = selectionSaved && (method === 'CRYPTO' ? Boolean(selectedCrypto) : method === 'GIFTCARD' ? Boolean(selectedGiftCard) : false);

  const submitProof = async () => {
    if (!selectionReady) {
      setError(method === 'CRYPTO' ? 'Select a cryptocurrency and network.' : method === 'GIFTCARD' ? 'Select a gift card brand.' : 'Select a payment method first.');
      return;
    }
    if (!proof) {
      setError('Please select a screenshot or receipt before submitting.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await fetch(`${API}/payments/mine/${encodeURIComponent(paymentToken)}/proof`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proofUrl: proof,
          fileType: proofType,
          originalName: proofName,
          paymentMethod: method,
          cryptoCurrency: method === 'CRYPTO' ? crypto : undefined,
          cryptoNetwork: method === 'CRYPTO' ? network : undefined,
          giftCardBrand: method === 'GIFTCARD' ? giftCard : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to submit proof.');

      setPayment(data.payment);
      clearProof();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <main className="payment-page"><div className="payment-card"><p>Loading payment request…</p></div></main>;
  }

  if (error && !payment) {
    return <main className="payment-page"><div className="payment-card error-card"><h1>Payment request unavailable</h1><p>{error}</p><Link className="primary-button" to="/">Return Home</Link></div></main>;
  }

  const success = payment?.status === 'SUCCESS';
  const submitted = payment?.status === 'PROOF_SUBMITTED';
  const rejected = payment?.status === 'REJECTED';

  return (
    <main className="payment-page">
      <div className="payment-card">
        <p className="eyebrow">{success ? 'PAYMENT CONFIRMED' : submitted ? 'PROOF UNDER REVIEW' : rejected ? 'PAYMENT REJECTED' : 'CHOOSE PAYMENT METHOD'}</p>
        <h1>{success ? 'Payment confirmed.' : submitted ? 'Payment proof submitted.' : rejected ? 'Payment proof needs attention.' : 'Complete your payment'}</h1>

        <div className="membership-summary">
          <span>Payment token<strong>{payment.paymentToken}</strong></span>
          <span>Item<strong>{payment.metadata?.description || payment.type}</strong></span>
          <span>Amount<strong>{money(payment.originalAmount, payment.originalCurrency)}</strong></span>
        </div>

        {success ? (
          <>
            <p>Your payment has been confirmed by the designated support administrator. The associated purchase has been completed and your account has been updated.</p>
            <Link className="primary-button" to={payment.type === 'MEMBERSHIP' ? '/membership' : payment.type === 'MEETING' ? '/meetings' : '/gifts'}>View Purchase</Link>
          </>
        ) : submitted ? (
          <p>Your proof is now with the designated payment support administrator. Do not send another payment while this request is being reviewed.</p>
        ) : (
          <>
            <section className="payment-option-panel">
              <div className="payment-method-header">
                <div><span className="eyebrow">STEP 1</span><h2>Choose how you want to pay</h2></div>
                <span className="muted">Available payment methods</span>
              </div>

              {!hasMethods ? (
                <p className="auth-error">No payment methods are currently configured. Please contact payment support.</p>
              ) : (
                <div className="payment-method-tabs">
                  {hasCrypto && <button className={method === 'CRYPTO' ? 'active' : ''} onClick={() => { setMethod('CRYPTO'); setGiftCard(''); setSelectionSaved(false); setError(''); }} type="button">🪙 Crypto</button>}
                  {hasGiftCards && <button className={method === 'GIFTCARD' ? 'active' : ''} onClick={() => { setMethod('GIFTCARD'); setCrypto(''); setNetwork(''); setSelectionSaved(false); setError(''); }} type="button">🎁 Gift Cards</button>}
                </div>
              )}
            </section>

            {method === 'CRYPTO' && hasCrypto && (
              <section className="payment-option-panel">
                <h2>Select cryptocurrency &amp; network</h2>
                <div className="payment-choice-grid">
                  {options.cryptoOptions.map((option) => (
                    <button key={`${option.currency}-${option.network}`} className={crypto === option.currency && network === option.network ? 'selected' : ''} disabled={selectionSaving} onClick={() => chooseCrypto(option)} type="button">
                      {option.currency}<small>{option.network}</small>
                    </button>
                  ))}
                </div>
                {selectedCrypto && <div className="wallet-box">
                  <p>Send your payment using</p>
                  <strong>{selectedCrypto.currency} · {selectedCrypto.network}</strong>
                  <label>Wallet address<input readOnly value={selectedCrypto.walletAddress} /></label>
                  <button className="secondary-button" disabled={selectionSaving} onClick={() => navigator.clipboard?.writeText(selectedCrypto.walletAddress)} type="button">{selectionSaving ? 'Saving selection…' : 'Copy wallet address'}</button>
                  <p className="muted">Contact <strong>{payment.supportAdmin?.name}</strong> if you need payment instructions. Include token <strong>{payment.paymentToken}</strong>.</p>
                </div>}
              </section>
            )}

            {method === 'GIFTCARD' && hasGiftCards && (
              <section className="payment-option-panel">
                <h2>Select gift card</h2>
                <div className="payment-choice-grid">
                  {options.giftCardOptions.map((option) => <button key={option._id} className={giftCard === option.brand ? 'selected' : ''} disabled={selectionSaving} onClick={() => chooseGiftCard(option)} type="button">{option.brand}</button>)}
                </div>
                {selectedGiftCard && <div className="wallet-box"><h3>{selectedGiftCard.brand}</h3><p>{selectedGiftCard.instructions}</p><p className="muted">Contact <strong>{payment.supportAdmin?.name}</strong> and provide token <strong>{payment.paymentToken}</strong> for the exact gift-card instructions.</p></div>}
              </section>
            )}

            <section className="proof-box">
              <span className="eyebrow">STEP 2</span>
              <h2>{rejected ? 'Submit new payment proof' : "I've completed payment"}</h2>
              {rejected && <div className="payment-rejection"><strong>Administrator feedback</strong><p>{payment.adminNote || 'Your previous proof was not approved. Please submit a new screenshot or receipt.'}</p></div>}
              <p>{rejected ? 'Review the administrator feedback, correct the issue, and upload new proof for review.' : 'Upload a screenshot of the transaction or your payment receipt. The designated administrator will review it before your purchase is completed.'}</p>
              <label className="proof-upload"><span>Payment screenshot / receipt</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={chooseProof} /><small>JPG, PNG, WEBP or PDF · maximum 5 MB</small></label>
              {proof && <div className="proof-selected"><strong>{proofName}</strong><span>{proofType === 'application/pdf' ? 'PDF receipt' : 'Image selected'}</span><button className="secondary-button" onClick={clearProof} type="button">Remove</button></div>}
              <button className="primary-button" disabled={busy || selectionSaving || !selectionReady || !proof} onClick={submitProof} type="button">{busy ? 'Submitting…' : selectionSaving ? 'Saving payment method…' : rejected ? 'Submit replacement proof' : 'Submit payment proof'}</button>
            </section>

            {error && <p className="auth-error">{error}</p>}
          </>
        )}

        <div className="payment-actions"><button className="secondary-button" onClick={() => navigate(-1)} type="button">Go Back</button></div>
      </div>
    </main>
  );
}
