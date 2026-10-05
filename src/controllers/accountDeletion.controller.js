const service = require('../services/accountDeletion.service');
const responder = require('../utils/responder');
const logger = require('../utils/logger');
exports.deleteAccount = async (req,res) => {
  try {
    const token = req.get('x-deletion-token');
    const result = token ? await service.resume(token) : await service.begin(req.user.id,req.body,req.body.confirmation);
    return responder.success(res,result.complete?200:202,result.complete?'Account deleted':'Account deletion is in progress',result);
  } catch (error) {
    logger.error('Account deletion failed',error);
    const status = [400,401].includes(error.status) ? error.status : 503;
    const message = status === 503
      ? 'Deletion could not finish. Please retry to resume safely.'
      : error.message === 'Password is incorrect' ? 'Password is incorrect' : 'Please re-authenticate to continue deletion.';
    return responder.error(res,status,message);
  }
};
