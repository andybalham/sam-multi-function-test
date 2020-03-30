const AWS = require('aws-sdk');
const SNS = new AWS.SNS();
const uuid = require('uuid');
const addFlow = require('./AddFlow.js');
const flowActivityProxy = require('./FlowActivityProxy.js');

// TODO: Replace with DynamoDb
const flowInstanceStore = new Map();

exports.handler = async function (event) {

    const deps = {
        publish: async (params) => {
            return await SNS.publish(params).promise();
        },
        saveState: (state) => {
            flowInstanceStore.set(state.context.flowInstanceId, state);
        },
        loadState: (flowInstanceId) => {
            return flowInstanceStore.get(flowInstanceId);
        },
        addActivity: flowActivityProxy
    };

    const sns = event.Records[0].Sns;

    console.log(`sns: ${JSON.stringify(sns)}`);

    const messageType = (sns.MessageAttributes.MessageType !== undefined)
        ? sns.MessageAttributes.MessageType.Value
        : undefined;

    const message = JSON.parse(sns.Message);

    let response;

    switch (messageType) {

    case 'Request:AddFlow':
        response = await addFlow.handleRequest(undefined, message.body, deps);
        break;

    case 'Response:AddFlow':
        response = await addFlow.handleResume(message.context, message.body, deps);
        break;

    default:
        throw new Error(`Unhandled message type: ${messageType}`);
    }

    return response;
};

const steps = [
    {
        name: 'x + total',
        getRequest: (data) => { return { TYPE_NAME: 'Add', value1: data.x, value2: data.total }; },
        processResponse: (response, data) => { data.total = response.total; }
    },
    {
        name: 'y + total',
        getRequest: (data) => { return { TYPE_NAME: 'Add', value1: data.y, value2: data.total }; },
        processResponse: (response, data) => { data.total = response.total; }
    },
    {
        name: 'z + total',
        getRequest: (data) => { return { TYPE_NAME: 'Add', value1: data.z, value2: data.total }; },
        processResponse: (response, data) => { data.total = response.total; }
    }
];

exports.handleRequest = async function (_flowContext, flowRequest, deps) {

    const state = {
        context: {
            flowName: 'AddFlow',
            flowInstanceId: uuid.v4(),
            flowMessageCount: 0
        },
        data: {
            x: flowRequest.x,
            y: flowRequest.y,
            z: flowRequest.z,
            total: 0
        }
    };

    const flowResponse = await runFlow(0, state, deps);

    return flowResponse;
};

exports.handleResume = async function (flowContext, activityResponse, deps) {

    const state = deps.loadState(flowContext.flowInstanceId);

    if (state === undefined) {
        throw new Error(`No state could be loaded for instance id: ${flowContext.flowInstanceId}`);
    }

    if (state.context.flowMessageCount > 100) {
        throw new Error(`Message count exceeed the maximum threshold: ${state.context.flowMessageCount}`);
    }

    if (state.context.flowRequestId !== flowContext.flowRequestId) {
        throw new Error(`Expected request id: ${state.context.flowRequestId}, but got: ${flowContext.flowRequestId}`);
    }

    const stepIndex = steps.findIndex(step => step.name === flowContext.stepName);

    if (stepIndex === -1) {
        throw new Error(`No step could be found with name: ${flowContext.stepName}`);
    }

    const step = steps[stepIndex];

    step.processResponse(activityResponse, state.data);

    const flowResponse = await runFlow(stepIndex + 1, state, deps);

    return flowResponse;
};

async function runFlow(startIndex, state, deps) {

    for (let stepIndex = startIndex; stepIndex < steps.length; stepIndex++) {

        const step = steps[stepIndex];

        state.context.stepName = step.name;
        state.context.flowRequestId = uuid.v4();
        state.context.flowMessageCount += 1;

        const request = step.getRequest(state.data);

        const response = await deps.addActivity.handleRequest(state.context, request, deps);

        if (response) {

            step.processResponse(response, state.data);

        } else {

            deps.saveState(state);
            return;
        }
    }

    return {
        total: state.data.total
    };
}
