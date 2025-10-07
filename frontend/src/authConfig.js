import { LogLevel } from "@azure/msal-browser";

export const msalConfig = {
    auth: {
        clientId: "2d56816e-f773-4690-a001-778840e29b02",
        authority: "https://login.microsoftonline.com/388d2366-e92c-4531-819d-550b229132fc",
        redirectUri: "http://localhost:5173",
    },
    cache: {
        cacheLocation: "sessionStorage", 
        storeAuthStateInCookie: false, 
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) {
                    return;
                }
                switch (level) {
                    case LogLevel.Error:
                        console.error(message);
                        return;
                    case LogLevel.Info:
                        console.info(message);
                        return;
                    case LogLevel.Verbose:
                        console.debug(message);
                        return;
                    case LogLevel.Warning:
                        console.warn(message);
                        return;
                }
            }
        }
    }
};

export const loginRequest = {
    scopes: ["User.Read"],
    prompt: 'select_account', // This will force the account selection screen
    loginHint: '', // This will ensure the email field is empty
};
