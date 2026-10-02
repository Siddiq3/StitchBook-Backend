const resendProvider = require('./resend.provider');

const getProvider = () => String(process.env.EMAIL_PROVIDER || 'resend').trim().toLowerCase();

exports.send = async (message) => {
  const provider = getProvider();
  if (provider === 'resend') return resendProvider.send(message);

  const error = new Error(`Unsupported email provider: ${provider}`);
  error.code = 'EMAIL_PROVIDER_UNSUPPORTED';
  throw error;
};
