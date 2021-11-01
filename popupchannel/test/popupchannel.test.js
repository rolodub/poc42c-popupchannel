const { expect, matchTemplate, MatchStyle } = require('@aws-cdk/assert');
const cdk = require('@aws-cdk/core');
const Popupchannel = require('../lib/popupchannel-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Popupchannel.PopupchannelStack(app, 'MyTestStack');
    // THEN
    expect(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
