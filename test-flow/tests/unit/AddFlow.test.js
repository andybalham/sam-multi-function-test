'use strict';

const addFlowSUT = require('../../AddFlow.js');
const addActivity = require('../../AddActivity.js');
const flowActivityProxy = require('../../FlowActivityProxy.js');
const chai = require('chai');
const expect = chai.expect;

describe('Test AddFlow', function () {

    const testDeps = {
        totaliser: async (v1, v2) => { return Promise.resolve(v1 + v2); }
    };

    [
        { request: { x: 1, y: 2, z: 3 }, expectedResult: 6 },
    ].forEach(theory => {
        it(`Handles request synchronously ${JSON.stringify(theory)}`, async () => {

            testDeps.addActivity = addActivity;

            const response = await addFlowSUT.handleRequest(undefined, theory.request, testDeps);

            expect(response.total).to.equal(theory.expectedResult);
        });
    });

    [
        { request: { x: 1, y: 2, z: 3 }, expectedResult: 6 },
    ].forEach(theory => {
        it(`Handles request asynchronously ${JSON.stringify(theory)}`, async () => {

            const flowInstanceStore = new Map();
            testDeps.saveState = (state) => {
                flowInstanceStore.set(state.context.flowInstanceId, state);
            };
            testDeps.loadState = (flowInstanceId) => {
                return flowInstanceStore.get(flowInstanceId);
            };
            testDeps.deleteState = (flowInstanceId) => {
                return flowInstanceStore.delete(flowInstanceId);
            };

            testDeps.addActivity = flowActivityProxy;

            let actualMessageAttributes;
            let actualMessage;
            testDeps.publish = async (params) => {
                actualMessageAttributes = params.MessageAttributes;
                actualMessage = JSON.parse(params.Message);
                return { MessageId: 'MockMessageId' };
            };

            let asyncResponse;
            let syncResponse;

            asyncResponse = await addFlowSUT.handleRequest(undefined, theory.request, testDeps);

            expect(asyncResponse).to.be.undefined;
            expect(actualMessageAttributes).deep.equal({ MessageType: { DataType: 'String', StringValue: 'Add:Request' } });
            expect(actualMessage).to.not.be.undefined;

            // x + total

            ({ syncResponse, asyncResponse } = await handleAsyncAddRequest(syncResponse, actualMessage, testDeps, asyncResponse, actualMessageAttributes));

            // y + total

            ({ syncResponse, asyncResponse } = await handleAsyncAddRequest(syncResponse, actualMessage, testDeps, asyncResponse, actualMessageAttributes));

            // z + total

            syncResponse = await addActivity.handleRequest(actualMessage.context, actualMessage.body, testDeps);

            expect(syncResponse).to.not.be.undefined;

            const finalResponse = await addFlowSUT.handleResume(actualMessage.context, syncResponse, testDeps);

            expect(finalResponse).to.not.be.undefined;
            expect(finalResponse.total).to.equal(6);
        });
    });
});

async function handleAsyncAddRequest(syncResponse, actualMessage, testDeps, asyncResponse, actualMessageAttributes) {

    syncResponse = await addActivity.handleRequest(actualMessage.context, actualMessage.body, testDeps);

    expect(syncResponse).to.not.be.undefined;

    asyncResponse = await addFlowSUT.handleResume(actualMessage.context, syncResponse, testDeps);

    expect(asyncResponse).to.be.undefined;
    expect(actualMessageAttributes).deep.equal({ MessageType: { DataType: 'String', StringValue: 'Add:Request' } });
    expect(actualMessage).to.not.be.undefined;

    return { syncResponse, asyncResponse };
}
