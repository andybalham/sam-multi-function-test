const AWS = require('aws-sdk');
const SNS = new AWS.SNS();
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const uuid = require('uuid');

const addFlow = require('./AddFlow.js');
const flowActivityProxy = require('./FlowActivityProxy.js');

exports.handler = async function (event) {

    console.log(`process.env.FLOW_INSTANCE_TABLE_NAME: ${process.env.FLOW_INSTANCE_TABLE_NAME}`);

    const deps = {
        publish: async (params) => {
            return await SNS.publish(params).promise();
        },
        saveState: async (state) => {
            const params = {
                TableName: process.env.FLOW_INSTANCE_TABLE_NAME,
                Item: {
                    id: state.context.flowInstanceId,
                    context: state.context,
                    data: JSON.stringify(state.data),
                    lastUpdated: new Date().toISOString()
                }
            };
            await dynamoDb.put(params).promise();
        },
        loadState: async (flowInstanceId) => {
            var params = {
                TableName: process.env.FLOW_INSTANCE_TABLE_NAME,
                Key: {
                    id: flowInstanceId
                }
            };
            const flowInstanceItem = await dynamoDb.get(params).promise();
            const state = {
                context: flowInstanceItem.Item.context,
                data: JSON.parse(flowInstanceItem.Item.data)
            };
            return state;
        },
        deleteState: async (flowInstanceId) => {
            var params = {
                TableName: process.env.FLOW_INSTANCE_TABLE_NAME,
                Key: {
                    id: flowInstanceId
                }
            };
            await dynamoDb.delete(params).promise();
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

    case 'AddFlow:Request':
        response = await addFlow.handleRequest(undefined, message.body, deps);
        break;

    case 'AddFlow:Response':
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

    const state = await deps.loadState(flowContext.flowInstanceId);

    state.isLoaded = true;

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

            await deps.saveState(state);
            return;
        }
    }

    if (state.isLoaded) {
        await deps.deleteState(state.context.flowInstanceId);        
    }

    return {
        total: state.data.total
    };
}
