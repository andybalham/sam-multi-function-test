const AWS = require('aws-sdk');
const sns = new AWS.SNS();
const flowActivity = require('./FlowActivity.js');

exports.handle = async function(event, activity, deps) {

    const env = {
        requestResponseTopicArn: process.env.REQUEST_RESPONSE_TOPIC_ARN
    };

    deps.publish = async (params) => {
        return await sns.publish(params).promise();
    };
    
    const publishResponse = await flowActivity.handleMessage(event, activity, env, deps);
    return publishResponse.MessageId;
};

exports.handleMessage = async function (event, activity, env, deps) {

    if (!activity.HANDLED_REQUEST_NAME) {
        throw new Error('HANDLED_REQUEST_NAME not specified');
    }
    
    const requestMessage = getRequestMessage(event, activity.HANDLED_REQUEST_NAME);
    
    const response = await activity.handleRequest(requestMessage.context, requestMessage.body, deps);

    const publishResponse = await publishResponseMessage(requestMessage, response, env, deps);
    return publishResponse;
};

function getRequestMessage(event, handledRequestType) {

    const sns = event.Records[0].Sns;
    
    console.log(`Request sns: ${JSON.stringify(sns)}`);
    
    const requestType = (sns.MessageAttributes.RequestType !== undefined)
        ? sns.MessageAttributes.RequestType.Value
        : undefined;

    if (requestType !== handledRequestType) {
        throw new Error(`Unexpected request type: ${requestType}`);
    }

    const message = JSON.parse(sns.Message);

    return message;
}

async function publishResponseMessage(requestMessage, response, env, deps) {

    let params = {
        Message: JSON.stringify({
            context: requestMessage.context,
            body: response
        }),
        TopicArn: env.requestResponseTopicArn,
        MessageAttributes: {
            FlowName: { DataType: 'String', StringValue: requestMessage.context.flowName }
        }
    };
    
    console.log(`Response params: ${JSON.stringify(params)}`);

    const publishResponse = await deps.publish(params);

    console.log(`Response MessageId: ${publishResponse.MessageId}`);

    return publishResponse;
}