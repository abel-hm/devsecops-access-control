'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DUMMY_PASSWORD_HASH = '$2b$10$8pE46pKuusnW1QIRXhltW.9o54Y0OME.sDPSLsrolJPvtcjblgywq';

function createAuthentication({ config, store }) {
  async function login(req, res) {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const user = store.users.find((candidate) => candidate.email.toLowerCase() === email && candidate.active);

    // Always compare a bcrypt hash, including for an unknown email, and return
    // one generic response so the endpoint does not disclose account existence.
    const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Identity claims only. Role and branch are reloaded from our user record.
    const token = jwt.sign(
      { sub: user.id },
      config.jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: config.jwtExpiresIn,
        issuer: config.jwtIssuer,
        audience: config.jwtAudience
      }
    );
    return res.status(200).json({ accessToken: token, tokenType: 'Bearer', expiresIn: 900 });
  }

  function authenticate(req, res, next) {
    const authorization = req.get('authorization') || '';
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    if (!match) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let payload;
    try {
      payload = jwt.verify(match[1], config.jwtSecret, {
        algorithms: ['HS256'],
        issuer: config.jwtIssuer,
        audience: config.jwtAudience
      });
    } catch (_error) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!payload || typeof payload.sub !== 'string') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = store.users.find((candidate) => candidate.id === payload.sub);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Never use role/branch values from headers, query parameters or the JWT.
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId
    };
    return next();
  }

  return { login, authenticate };
}

module.exports = { createAuthentication };
