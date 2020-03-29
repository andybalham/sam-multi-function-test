const flowActivity = require('./FlowActivity.js');
const addActivity = require('./AddActivity.js');

exports.HANDLED_REQUEST_NAME = 'AddRequest';

exports.handler = async function (event) {

    const deps = {
        totaliser: async (v1, v2) => { return Promise.resolve(v1 + v2); }
    };
    
    return await flowActivity.handle(event, addActivity, deps);
};    

exports.handleRequest = async function(request, deps) {

    ensureNumber('value1', request.value1);
    ensureNumber('value2', request.value2);

    const total = await deps.totaliser(request.value1, request.value2);
    
    const response = {
        total: total
    };

    return response;
};

function ensureNumber(name, value) {

    if (!value) {
        throw new Error(`Request value not specified: ${name}`);
    }

    if (typeof value !== 'number') {
        throw new Error(`Request value not a number: ${name}=${value}`);
    }
}