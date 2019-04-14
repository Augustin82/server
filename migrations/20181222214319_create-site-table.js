const { enableAutoUpdate, disableAutoUpdate } = require('../autoUpdate.js')

const table = 'sites'

exports.up = (knex) => knex.raw(`
  CREATE TABLE IF NOT EXISTS ${table} (
    id SERIAL PRIMARY KEY,
    hostname TEXT UNIQUE NOT NULL,
    verified boolean NOT NULL DEFAULT false,
    dns_tag UUID UNIQUE NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
  );

  ${enableAutoUpdate(table)}
`)

exports.down = (knex) => knex.raw(`
  ${disableAutoUpdate(table)}
  DROP TABLE IF EXISTS ${table};
`)
