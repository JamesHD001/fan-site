import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/advancedSecuritySettings.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const AdvancedSecuritySettings = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // 2FA States
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [requireOtpOnLogin, setRequireOtpOnLogin] = useState(false);
  const [setupInProgress, setSetupInProgress] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [setupSecretTemp, setSetupSecretTemp] = useState('');
  const [verifyToken, setVerifyToken] = useState('');

  // Phone States
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneNumberVerified, setPhoneNumberVerified] = useState(false);
  const [phoneUpdating, setPhoneUpdating] = useState(false);
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('');
  const [phoneVerifying, setPhoneVerifying] = useState(false);

  // Password Confirmation
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // Initialize
  useEffect(() => {
    if (!token) navigate('/login');
    if (user) {
      setTwoFactorEnabled(user.twoFactorEnabled || false);
      setRequireOtpOnLogin(user.requireOtpOnLogin || false);
      setPhoneNumber(user.phoneNumber || '');
      setPhoneNumberVerified(user.phoneNumberVerified || false);
    }
  }, [user, token, navigate]);

  const handleApiError = (err) => {
    const message =
      err?.response?.data?.message || err?.message || 'An error occurred';
    setError(message);
  };

  // ============ 2FA Setup ============
  const initiate2FA = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/2fa/setup/initiate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to initiate 2FA');
      }
      const data = await response.json();
      setQrCode(data.qrCode);
      setBackupCodes(data.backupCodes);
      setSetupSecretTemp(data._tempSecret);
      setSetupInProgress(true);
      setSuccess('Scan the QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.)');
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const verify2FA = async () => {
    if (!verifyToken) {
      setError('Please enter the 6-digit code from your authenticator app');
      return;
    }
    if (!/^\d{6}$/.test(verifyToken)) {
      setError('Verification code must be 6 digits');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/2fa/setup/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          totpToken: verifyToken,
          secret: setupSecretTemp,
          backupCodes: backupCodes,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to verify 2FA');
      }
      setTwoFactorEnabled(true);
      setSetupInProgress(false);
      setVerifyToken('');
      setSetupSecretTemp('');
      setQrCode('');
      setSuccess('Two-factor authentication has been enabled successfully!');
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!passwordConfirm) {
      setError('Please enter your password to disable 2FA');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/2fa/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: passwordConfirm }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to disable 2FA');
      }
      setTwoFactorEnabled(false);
      setRequireOtpOnLogin(false);
      setPasswordConfirm('');
      setShowPasswordConfirm(false);
      setSuccess('Two-factor authentication has been disabled.');
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleOtpOnLogin = async (enabled) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me/security-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requireOtpOnLogin: enabled }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update settings');
      }
      setRequireOtpOnLogin(enabled);
      setSuccess(`OTP on login has been ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  // ============ Phone Number ============
  const updatePhone = async () => {
    if (!phoneNumber) {
      setError('Please enter a phone number');
      return;
    }
    setError('');
    setSuccess('');
    setPhoneUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me/phone`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneNumber }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update phone number');
      }
      setPhoneVerifying(true);
      setSuccess('A verification code has been sent. Please enter it below.');
    } catch (err) {
      handleApiError(err);
    } finally {
      setPhoneUpdating(false);
    }
  };

  const verifyPhoneNumber = async () => {
    if (!phoneVerificationCode) {
      setError('Please enter the verification code');
      return;
    }
    setError('');
    setSuccess('');
    setPhoneUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me/phone/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otp: phoneVerificationCode }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to verify phone number');
      }
      setPhoneNumberVerified(true);
      setPhoneVerifying(false);
      setPhoneVerificationCode('');
      setSuccess('Phone number verified successfully!');
    } catch (err) {
      handleApiError(err);
    } finally {
      setPhoneUpdating(false);
    }
  };

  const regenerateBackupCodes = async () => {
    if (!passwordConfirm) {
      setError('Please enter your password to regenerate backup codes');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/2fa/regenerate-backup-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: passwordConfirm }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to regenerate backup codes');
      }
      const data = await response.json();
      setBackupCodes(data.backupCodes);
      setPasswordConfirm('');
      setSuccess('Backup codes have been regenerated. Save them in a safe place!');
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="advanced-security-settings">
      <div className="security-container">
        <div className="security-header">
          <h1>Account Security Settings</h1>
          <p>Manage your account security preferences and authentication methods</p>
        </div>

        <div className="security-tabs">
          <button
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab-button ${activeTab === 'twofa' ? 'active' : ''}`}
            onClick={() => setActiveTab('twofa')}
          >
            Two-Factor Authentication
          </button>
          <button
            className={`tab-button ${activeTab === 'phone' ? 'active' : ''}`}
            onClick={() => setActiveTab('phone')}
          >
            Phone Number
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            <div className="security-card">
              <div className="card-header">
                <h3>Security Summary</h3>
              </div>
              <div className="security-checks">
                <div className="security-item">
                  <span className="check-icon">✓</span>
                  <div className="check-info">
                    <h4>Email Verified</h4>
                    <p>{user?.emailVerified ? 'Your email is verified' : 'Verify your email address'}</p>
                  </div>
                </div>
                <div className="security-item">
                  <span className={`check-icon ${twoFactorEnabled ? 'enabled' : 'disabled'}`}>
                    {twoFactorEnabled ? '✓' : '○'}
                  </span>
                  <div className="check-info">
                    <h4>Two-Factor Authentication</h4>
                    <p>{twoFactorEnabled ? 'Enabled - Your account has enhanced security' : 'Not enabled - Add extra protection'}</p>
                  </div>
                </div>
                <div className="security-item">
                  <span className={`check-icon ${phoneNumberVerified ? 'enabled' : 'disabled'}`}>
                    {phoneNumberVerified ? '✓' : '○'}
                  </span>
                  <div className="check-info">
                    <h4>Phone Number</h4>
                    <p>{phoneNumberVerified ? `Verified: ${phoneNumber}` : 'Add and verify your phone number'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="security-recommendations">
              <h3>Recommended Security Actions</h3>
              {!twoFactorEnabled && (
                <div className="recommendation">
                  <strong>Enable Two-Factor Authentication</strong>
                  <p>Add an extra layer of security to your account by requiring a code from your phone when you log in.</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveTab('twofa')}
                  >
                    Set Up 2FA
                  </button>
                </div>
              )}
              {!phoneNumberVerified && (
                <div className="recommendation">
                  <strong>Verify Your Phone Number</strong>
                  <p>Use your phone number as a backup authentication method and receive important security alerts.</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveTab('phone')}
                  >
                    Add Phone Number
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2FA Tab */}
        {activeTab === 'twofa' && (
          <div className="tab-content">
            {!twoFactorEnabled && !setupInProgress && (
              <div className="security-card">
                <div className="card-header">
                  <h3>Set Up Two-Factor Authentication</h3>
                </div>
                <div className="card-body">
                  <p>Two-factor authentication adds an extra layer of security to your account. You'll need to enter a code from your phone whenever you log in.</p>
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={initiate2FA}
                    disabled={loading}
                  >
                    {loading ? 'Preparing...' : 'Start Setup'}
                  </button>
                </div>
              </div>
            )}

            {setupInProgress && (
              <div className="security-card">
                <div className="card-header">
                  <h3>Complete 2FA Setup</h3>
                </div>
                <div className="card-body">
                  <div className="setup-steps">
                    <div className="step">
                      <div className="step-number">1</div>
                      <div className="step-content">
                        <h4>Scan QR Code</h4>
                        <p>Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.) and scan this QR code:</p>
                        {qrCode && <img src={qrCode} alt="2FA QR Code" className="qr-code" />}
                      </div>
                    </div>

                    <div className="step">
                      <div className="step-number">2</div>
                      <div className="step-content">
                        <h4>Enter Verification Code</h4>
                        <p>Enter the 6-digit code from your authenticator app:</p>
                        <input
                          type="text"
                          placeholder="000000"
                          value={verifyToken}
                          onChange={(e) => setVerifyToken(e.target.value.slice(0, 6))}
                          maxLength="6"
                          className="code-input"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="step">
                      <div className="step-number">3</div>
                      <div className="step-content">
                        <h4>Save Backup Codes</h4>
                        <p>If you lose access to your authenticator app, you can use these backup codes to sign in:</p>
                        <div className="backup-codes-display">
                          {backupCodes.map((code, idx) => (
                            <code key={idx}>{code}</code>
                          ))}
                        </div>
                        <p className="backup-warning">⚠️ Save these codes somewhere safe. Each can only be used once.</p>
                      </div>
                    </div>

                    <div className="setup-actions">
                      <button
                        className="btn btn-primary"
                        onClick={verify2FA}
                        disabled={loading || !verifyToken}
                      >
                        {loading ? 'Verifying...' : 'Verify & Enable'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setSetupInProgress(false);
                          setQrCode('');
                          setBackupCodes([]);
                          setVerifyToken('');
                        }}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {twoFactorEnabled && !setupInProgress && (
              <div className="security-card">
                <div className="card-header">
                  <h3>Two-Factor Authentication</h3>
                  <span className="status-badge enabled">✓ Enabled</span>
                </div>
                <div className="card-body">
                  <div className="setting-item">
                    <div className="setting-info">
                      <h4>Require OTP on Login</h4>
                      <p>Require a verification code every time you sign in</p>
                    </div>
                    <div className="setting-toggle">
                      <input
                        type="checkbox"
                        id="requireOtpToggle"
                        checked={requireOtpOnLogin}
                        onChange={(e) => toggleOtpOnLogin(e.target.checked)}
                        disabled={loading}
                      />
                      <label htmlFor="requireOtpToggle"></label>
                    </div>
                  </div>

                  <div className="divider"></div>

                  <div className="setting-item">
                    <h4>Regenerate Backup Codes</h4>
                    <p>Generate new backup codes to replace your current ones</p>
                    {!showPasswordConfirm ? (
                      <button
                        className="btn btn-secondary"
                        onClick={() => setShowPasswordConfirm(true)}
                      >
                        Regenerate
                      </button>
                    ) : (
                      <div className="password-confirm">
                        <input
                          type="password"
                          placeholder="Enter your password"
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          disabled={loading}
                        />
                        <button
                          className="btn btn-secondary"
                          onClick={regenerateBackupCodes}
                          disabled={loading || !passwordConfirm}
                        >
                          Confirm
                        </button>
                        <button
                          className="btn btn-outline"
                          onClick={() => {
                            setShowPasswordConfirm(false);
                            setPasswordConfirm('');
                          }}
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="divider"></div>

                  <div className="danger-zone">
                    <h4>Disable Two-Factor Authentication</h4>
                    <p>Your account will be less secure if you disable this.</p>
                    {!showPasswordConfirm ? (
                      <button
                        className="btn btn-danger"
                        onClick={() => setShowPasswordConfirm(true)}
                      >
                        Disable 2FA
                      </button>
                    ) : (
                      <div className="password-confirm">
                        <input
                          type="password"
                          placeholder="Enter your password to confirm"
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          disabled={loading}
                        />
                        <button
                          className="btn btn-danger"
                          onClick={disable2FA}
                          disabled={loading || !passwordConfirm}
                        >
                          Disable
                        </button>
                        <button
                          className="btn btn-outline"
                          onClick={() => {
                            setShowPasswordConfirm(false);
                            setPasswordConfirm('');
                          }}
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Phone Tab */}
        {activeTab === 'phone' && (
          <div className="tab-content">
            <div className="security-card">
              <div className="card-header">
                <h3>Phone Number</h3>
                {phoneNumberVerified && <span className="status-badge enabled">✓ Verified</span>}
              </div>
              <div className="card-body">
                {!phoneVerifying ? (
                  <>
                    <div className="form-group">
                      <label>Phone Number</label>
                      <input
                        type="tel"
                        placeholder="Enter your phone number (10+ digits)"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={phoneUpdating}
                      />
                      <p className="help-text">We'll use this number to send you verification codes and security alerts.</p>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={updatePhone}
                      disabled={phoneUpdating || !phoneNumber}
                    >
                      {phoneUpdating ? 'Sending verification code...' : 'Update Phone Number'}
                    </button>
                  </>
                ) : (
                  <>
                    <p>We've sent a verification code to {phoneNumber}. Enter it below:</p>
                    <div className="form-group">
                      <label>Verification Code</label>
                      <input
                        type="text"
                        placeholder="000000"
                        value={phoneVerificationCode}
                        onChange={(e) => setPhoneVerificationCode(e.target.value)}
                        maxLength="6"
                        disabled={phoneUpdating}
                      />
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={verifyPhoneNumber}
                      disabled={phoneUpdating || !phoneVerificationCode}
                    >
                      {phoneUpdating ? 'Verifying...' : 'Verify Code'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedSecuritySettings;
