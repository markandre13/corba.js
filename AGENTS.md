# AGENTS.md

corba.js: an ORB (runtime) plus an IDL compiler for TypeScript. ESM (`"type": "module"`), Node >= 21.7.1. Current toolchain: TypeScript 6, mocha 12, ts-patch 4.

## Commands

- `npm test`: full build, then mocha on `lib/test/**/*.spec.js`. Always rebuilds, so it is the safe default.
- `npm run build`: IDL bundle, then IDL codegen into `test/generated`, then `tspc` emit to `lib/`. `tspc` is the only type check. There is no separate typecheck, lint, or formatter script.
- Single spec, no watch: run `npm run build` first, then
  `NODE_EXTRA_CA_CERTS=test/x509/root/certs/root.cert.pem node ./node_modules/.bin/mocha --exit lib/test/giop.spec.js`.
  Mocha runs compiled `lib/test/*.js`, not `.ts`, so rebuild after any source change.
- `npm run dev:build` and `npm run dev:test` are watch modes that never exit. Do not run them in the foreground.
- `NODE_EXTRA_CA_CERTS` is needed for TLS/WSS tests. `npm test` sets it; set it yourself for direct mocha runs.

## Test baseline

`npm test` should report 132 passing, 17 pending, 0 failing. The 17 pending are specs disabled with `xit`/`xdescribe` (e.g. `access.spec.ts`, `initialreferences.spec.ts`).
If the failure count rises, the change is responsible.

The in-memory transport (`mockConnection()` in `test/util.ts`) names its addresses from the client's view:
the server is `remote-mock`, the client is `local-mock`. Specs must address the server as
`corbaname::remote-mock:0#Name`. The server's IOR host comes from its own address, so the two must match.

## Layout

- `src/orb/`: runtime. `index.ts` is the package entry (`corba.js`). `giop.ts` holds CDR/GIOP encoding, `connection.ts`/`protocol.ts` handle transport plumbing, `ior.ts`/`url.ts` parse IORs and corbaloc/corbaname, `asn1.ts` supports GSSUP auth.
- `src/net/`: transports. `ws.ts` (server and shared code), `browser.ts` (browser WebSocket client), `tcp.ts`, `tls.ts`. Exported as `corba.js/net/*`.
- `src/idl/`: IDL compiler. `idl.ts` is the CLI entry, bundled by rollup into `lib/idl/idl.cjs`. `ts/` generates TypeScript stubs, skeletons, and value types. `cc/` generates C++ (used by the sibling corba.cc project).
- `bin/corba-idl`: shell wrapper that runs `lib/idl/idl.cjs`. It fails until the rollup step has run.
- `test/`: mocha specs (`*.spec.ts`), each paired with `.idl` files. `test/generated/` is gitignored output, regenerated on every build. Do not edit it. `test/x509/` holds test certificates. `test/giop/*.dump` are byte fixtures for `giop.spec`.
- `lib/`: gitignored build output.
- `test-mico/` and `test/peer/{mico,omni}`: interop with external ORBs on the LAN host 192.168.1.105, driven by `npm run mico:*` / `omni:*` (ssh/scp). Not part of `npm test`; they need that host.
- `CORBA.md`: technical notes on GIOP/CDR, CSI security, and value types. Read it before changing protocol code.

## Gotchas

- Cross-package imports use the `corba.js/...` alias (see `tsconfig.json` paths). `m13-es-transformer.cjs` rewrites them and appends `.js` in the emitted output. Keep imports in the same style as the existing files.
- Changing the IDL compiler (`src/idl/**`) or any `.idl` file needs `npm run build`. The rollup bundle and `test/generated` both have to be regenerated before `tspc`.
- Tests bind fixed ports (2809 in `net/*.spec.ts`, 8080 in `access.spec.ts`). A leftover process holding one of these ports can break those specs, so check for stale ones if they fail oddly.
- `README.md` is partly stale. Its "Protocol" section says JSON, but the implementation speaks CORBA GIOP/CDR (`src/orb/giop.ts`, `test/giop/`). Trust the code over the README.
