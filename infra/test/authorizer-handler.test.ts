// @ts-ignore
import { handler } from '../handlers/authorizer';


describe('Authorizer Handler', () => {
  it('should return an Allow policy and user claims', async () => {
    const payload = { sub: 'mock-user-id', email: 'mock@example.com' };
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const mockToken = `${encodedHeader}.${encodedPayload}.signature`;

    const event = {
      queryStringParameters: {
        token: mockToken
      },
      methodArn: 'arn:aws:execute-api:us-east-1:123456789012:api-id/stage/METHOD/resource'
    };

    const result = await handler(event);

    expect(result.principalId).toBe('mock-user-id');
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(result.context.sub).toBe('mock-user-id');
    expect(result.context.email).toBe('mock@example.com');
  });

  it('should deny if token is missing', async () => {
      const event = {
        queryStringParameters: {},
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:api-id/stage/METHOD/resource'
      };
  
      const result = await handler(event);
  
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    });
});
