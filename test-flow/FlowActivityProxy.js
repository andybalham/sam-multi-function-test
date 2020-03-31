exports.handleRequest = async function(context, request, deps) {

    let params = {
        Message: JSON.stringify({
            context: context,
            body: request
        }),
        TopicArn: process.env.REQUEST_RESPONSE_TOPIC_ARN,
        MessageAttributes: {
            MessageType: { DataType: 'String', StringValue: `${request.TYPE_NAME}:Request` }
        }
    };
    
    const publishResponse = await deps.publish(params);

    console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);
};
