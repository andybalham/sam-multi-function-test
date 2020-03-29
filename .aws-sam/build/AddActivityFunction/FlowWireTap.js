exports.handler = async function (event) {

    const sns = event.Records[0].Sns;
    
    const message = JSON.parse(sns.Message);

    const logEntry = {
        MessageAttributes: sns.MessageAttributes,
        MessageContext: message.context,
        MessageBody: message.body
    };

    console.log(`${JSON.stringify(logEntry)}`);
};    
