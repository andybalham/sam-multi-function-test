const thisHandlerName = 'functionX';

exports.handler = async function (event, context) {

    const snsData = event.Records[0].Sns;

    console.log(`snsData: ${JSON.stringify(snsData)}`);

    const targetHandler = snsData.MessageAttributes.TargetHandler.Value;

    if (targetHandler !== thisHandlerName) {
        throw new Error(`Unexpected target handler: ${targetHandler}`);
    }

    console.log("functionXXXXXXXXXXXXXXXXXXXXXXXXXX");

    return 'Hello World X!';
};