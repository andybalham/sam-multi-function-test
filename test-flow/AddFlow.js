// const handledRequestType = 'AddFlowRequest';

exports.handler = async function (event) {

    const sns = event.Records[0].Sns;

    console.log(`sns: ${JSON.stringify(sns)}`);

    // const requestType =
    //     (sns.MessageAttributes.RequestType !== undefined)
    //         ? sns.MessageAttributes.RequestType.Value
    //         : undefined;

    // if (requestType !== handledRequestType) {
    //     throw new Error(`Unexpected request type: ${requestType}`);
    // }
};

// eslint-disable-next-line no-unused-vars
exports.handleRequest = function(request, deps) {
    
    const response = {
    };

    return response;
};
