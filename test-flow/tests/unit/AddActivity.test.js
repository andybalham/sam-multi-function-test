'use strict';

const addActivitySUT = require('../../AddActivity.js');
const flowActivity = require('../../FlowActivity.js');
const chai = require('chai');
const expect = chai.expect;

describe('Test AddActivity', function () {

    it('Handles messages', async () => {
        
        const context = {
            flowName: 'AddFlow',
            flowStepName: 'StepName',
            flowInstanceId: 'd30a461d-168d-4dec-a86e-a2eee6272d20',
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
                        MessageAttributes: { RequestType: { Value: 'AddRequest' } }
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
        const mockDeps = {
            totaliser: (v1, v2) => { return v1 + v2; },
            publish: async (params) => {
                actualPublishedParams = params;
                actualResponse = JSON.parse(params.Message);
                return { MessageId: 'MockMessageId' };
            }
        };

        const publishedData = await flowActivity.handleMessage(event, addActivitySUT, env, mockDeps, 'AddRequest');

        expect(publishedData.MessageId).to.equal('MockMessageId');
        
        expect(actualPublishedParams.TopicArn).to.equal(env.requestResponseTopicArn);
        expect(actualPublishedParams.MessageAttributes).deep.equal({FlowName: { DataType: 'String', StringValue: context.flowName }});

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

        const mockDeps = {
            totaliser: (v1, v2) => { return v1 + v2; }
        };

        it(`Handles request ${JSON.stringify(theory)}`, async () => {
        
            if (typeof theory.expectedResult === 'number') {
                const response = addActivitySUT.handleRequest(theory.request, mockDeps);
                expect(response.total).to.equal(theory.expectedResult);
            }
            else {
                expect(() => {
                    addActivitySUT.handleRequest(theory.request, mockDeps);
                }).to.throw(theory.expectedResult);
            }
        });    
    });
});
