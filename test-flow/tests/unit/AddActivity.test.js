'use strict';

const addActivitySUT = require('../../AddActivity.js');
const flowActivity = require('../../FlowActivity.js');
const chai = require('chai');
const expect = chai.expect;

describe('Test AddActivity', function () {

    it('Handles messages', async () => {
        
        const context = {
            flowName: 'AddFlow',
            flowInstanceId: 'd30a461d-168d-4dec-a86e-a2eee6272d20',
            flowStepName: 'StepName',
            flowRequestId: '59624188-3a11-4ccb-bfcf-4f8e47285006',
            flowMessageCount: 1                
        };

        const messageJson = JSON.stringify({
            context: context,
            body: { value1: 1, value2: 2 }
        });

        const event = {
            Records: [
                {
                    Sns: {
                        Message: messageJson,
                        MessageAttributes: { MessageType: { Value: 'Request:Add' } }
                    }
                }
            ]
        };

        console.log(`eventJson: ${JSON.stringify(event)}`);

        const env = {
            requestResponseTopicArn: 'requestResponseTopicArn'
        };

        let actualPublishedParams;
        let actualResponse;
        const testDeps = {
            totaliser: async (v1, v2) => { return Promise.resolve(v1 + v2); },
            publish: async (params) => {
                actualPublishedParams = params;
                actualResponse = JSON.parse(params.Message);
                return { MessageId: 'MockMessageId' };
            }
        };

        const publishedData = await flowActivity.handleMessage(event, addActivitySUT, env, testDeps);

        expect(publishedData.MessageId).to.equal('MockMessageId');
        
        expect(actualPublishedParams.TopicArn).to.equal(env.requestResponseTopicArn);
        expect(actualPublishedParams.MessageAttributes).deep.equal({MessageType: { DataType: 'String', StringValue: `Response:${context.flowName}` }});

        expect(actualResponse.context).deep.equal(context);        
        expect(actualResponse.body).deep.equal({total: 3});
    });

    [
        { request: { value1: 1, value2: 2 }, expectedResult: 3 },
        { request: { value1: undefined, value2: 2 }, expectedResult: 'Request value not specified: value1' },
        { request: { value1: 1, value2: undefined }, expectedResult: 'Request value not specified: value2' },
        { request: { value1: 'X', value2: 2 }, expectedResult: 'Request value not a number: value1=X' },
        { request: { value1: 1, value2: 'X' }, expectedResult: 'Request value not a number: value2=X' },        
    ].forEach(theory => {

        const context = undefined;

        const testDeps = {
            totaliser: async (v1, v2) => { return Promise.resolve(v1 + v2); }
        };

        it(`Handles request ${JSON.stringify(theory)}`, async () => {
        
            if (typeof theory.expectedResult === 'number') {
                
                const response = await addActivitySUT.handleRequest(context, theory.request, testDeps);
                expect(response.total).to.equal(theory.expectedResult);

            } else {

                try {
                    await addActivitySUT.handleRequest(context, theory.request, testDeps);                    
                } catch (error) {
                    expect(error.message).to.equal(theory.expectedResult);        
                }
            }
        });    
    });
});
