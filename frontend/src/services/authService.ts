import {
  CognitoUserPool,
  CognitoUserAttribute,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession
} from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_mockpool',
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || 'mockclientid123'
};

export const userPool = new CognitoUserPool(poolData);

export const signUp = (email: string, password: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const attributeList: CognitoUserAttribute[] = [];
    
    // O pool foi configurado para login por email
    userPool.signUp(email, password, attributeList, [], (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
};

export const confirmSignUp = (email: string, code: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const userData = {
      Username: email,
      Pool: userPool
    };

    const cognitoUser = new CognitoUser(userData);

    cognitoUser.confirmRegistration(code, true, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
};

export const signIn = (email: string, password: string): Promise<CognitoUserSession> => {
  return new Promise((resolve, reject) => {
    const authenticationData = {
      Username: email,
      Password: password
    };

    const authenticationDetails = new AuthenticationDetails(authenticationData);

    const userData = {
      Username: email,
      Pool: userPool
    };

    const cognitoUser = new CognitoUser(userData);

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (session) => {
        resolve(session);
      },
      onFailure: (err) => {
        reject(err);
      }
    });
  });
};

export const signOut = () => {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) {
    cognitoUser.signOut();
  }
};

export const getSession = (): Promise<CognitoUserSession> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      reject(new Error('No user logged in'));
      return;
    }

    cognitoUser.getSession((err: any, session: CognitoUserSession | null) => {
      if (err || !session) {
        reject(err || new Error('No session available'));
        return;
      }
      resolve(session);
    });
  });
};

export const getIdToken = async (): Promise<string | null> => {
  try {
    const session = await getSession();
    return session.getIdToken().getJwtToken();
  } catch {
    return null;
  }
};

export const getCurrentUserEmail = (): string | null => {
  const cognitoUser = userPool.getCurrentUser();
  return cognitoUser ? cognitoUser.getUsername() : null;
};

export const getGoogleLoginUrl = (): string => {
  const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN || 'push-bolt-v2-auth-mock.auth.us-east-1.amazoncognito.com';
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || 'mockclientid123';
  const redirectUri = window.location.origin;
  
  const cleanDomain = cognitoDomain.replace(/^https?:\/\//, '');
  
  return `https://${cleanDomain}/oauth2/authorize?identity_provider=Google&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&client_id=${clientId}&scope=email+openid+profile`;
};
