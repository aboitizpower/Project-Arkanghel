import cors from 'cors';

// Environment-based CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? [
        // Production origins - add your actual production URLs here
        'https://yourdomain.com',
        'https://www.yourdomain.com'
    ]
    : [
        // Development origins
        'http://localhost:5173', // Vite default port
        'http://127.0.0.1:5173'
    ];

const corsOptions = {
    origin: function (origin, callback) {
        console.log(`CORS request from origin: ${origin}`); // Debug logging
        
        // Allow requests without origin (e.g., direct image requests, same-origin requests)
        if (!origin) {
            console.log('Allowing request with no origin (likely same-origin or direct resource request)');
            return callback(null, true);
        }
        
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = `CORS policy violation: Origin '${origin}' not in allowlist`;
            console.error(msg);
            return callback(new Error(msg), false);
        }
        
        console.log(`CORS request approved for origin: ${origin}`);
        return callback(null, true);
    },
    credentials: true, // Allow credentials but with strict origin checking
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Remove OPTIONS from allowed methods
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With', 
        'Accept'
        // Removed Origin and X-CSRF-Token to be more restrictive
    ],
    exposedHeaders: [], // Don't expose any headers
    maxAge: 1800, // Reduce to 30 minutes for better security
    optionsSuccessStatus: 204, // Use 204 instead of 200 for OPTIONS
    preflightContinue: false // Don't pass control to next handler
};

// Create CORS middleware
const corsMiddleware = cors(corsOptions);

// Secure preflight middleware
const preflightMiddleware = (req, res, next) => {
    if (req.method === 'OPTIONS') {
        const origin = req.headers.origin;
        
        // Only set CORS headers for allowed origins
        if (origin && allowedOrigins.includes(origin)) {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token');
            res.header('Access-Control-Allow-Credentials', 'true');
            res.header('Access-Control-Max-Age', '3600');
        } else {
            // Reject preflight for unauthorized origins
            console.warn(`CORS preflight rejected for origin: ${origin}`);
            res.status(403).json({ error: 'CORS policy violation' });
            return;
        }
        
        res.status(200).end();
        return;
    }
    next();
};

export { corsMiddleware, preflightMiddleware };
