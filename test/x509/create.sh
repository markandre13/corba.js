#!/bin/sh -ex
#
# Create certificates for tests
#

rm -rf root intermediate

mkdir -p root/certs root/crl root/newcerts root/private
chmod 700 root/private
touch root/index.txt
echo 1000 > root/serial

mkdir -p intermediate/certs intermediate/crl intermediate/newcerts intermediate/private intermediate/csr
chmod 700 intermediate/private
touch intermediate/index.txt
echo 1000 > intermediate/serial
echo 1000 > intermediate/crlnumber

passphrase="alice"

cat<<EOF
###########################################################
# Generate Root CA Private Key
###########################################################
EOF

openssl genpkey \
    -algorithm RSA \
    -pkeyopt rsa_keygen_bits:1024 \
    -out root/private/root.key.pem \
    -pass "pass:$passphrase" \
    -aes-256-cbc
chmod 400 root/private/root.key.pem

cat<<EOF
###########################################################
# Generate Root CA Certificate
###########################################################
EOF

cat<<EOF | openssl req -config root.cnf \
      -passin "pass:$passphrase" \
      -key root/private/root.key.pem \
      -new -x509 -days 7300 -sha256 -extensions v3_ca \
      -out root/certs/root.cert.pem
DE
Berlin

mark13
the lords of administration
mark13.org
root@mark13.org

EOF

openssl x509 -in root/certs/root.cert.pem -noout -text

cat<<EOF
###########################################################
# Generate Intermediate CA Private Key
###########################################################
EOF

openssl genpkey \
    -algorithm RSA \
    -pkeyopt rsa_keygen_bits:1024 \
    -out intermediate/private/intermediate.key.pem \
    -pass "pass:$passphrase" \
    -aes-256-cbc
chmod 400 intermediate/private/intermediate.key.pem

cat<<EOF
###########################################################
# Generate Intermediate CA Certificate Request
###########################################################
EOF

cat<<EOF | openssl req -config intermediate.cnf \
      -passin "pass:$passphrase" \
      -config intermediate.cnf -new -sha256 \
      -key intermediate/private/intermediate.key.pem \
      -out intermediate/csr/intermediate.csr.pem     
DE
Berlin

mark13
the real heroes here
ca.mark13.org
intermediate@mark13.org

EOF

cat<<EOF
###########################################################
# Sign Intermediate CA Certificate Request with Root CA
###########################################################
EOF

cat<<EOF | openssl ca -config root.cnf -extensions v3_intermediate_ca \
      -passin "pass:$passphrase" \
      -days 3650 -notext -md sha256 \
      -in intermediate/csr/intermediate.csr.pem \
      -out intermediate/certs/intermediate.cert.pem
y
y
EOF

openssl x509 -in intermediate/certs/intermediate.cert.pem -noout -text

cat<<EOF
###########################################################
# Create Certificate Chain File
###########################################################
EOF

cat intermediate/certs/intermediate.cert.pem \
    root/certs/root.cert.pem \
    > intermediate/certs/ca-chain.cert.pem
chmod 444 intermediate/certs/ca-chain.cert.pem

cat<<EOF
###########################################################
# Generate Server Private Key
###########################################################
EOF

openssl genpkey \
    -algorithm RSA \
    -pkeyopt rsa_keygen_bits:1024 \
    -out intermediate/private/server.key.pem \
    -pass "pass:$passphrase" \
    -aes-256-cbc
chmod 400 intermediate/private/server.key.pem

cat<<EOF
###########################################################
# Generate Server Certificate Request
###########################################################
EOF

cat<<EOF | openssl req -config intermediate.cnf \
      -passin "pass:$passphrase" \
      -config intermediate.cnf -new -sha256 \
      -key intermediate/private/server.key.pem \
      -out intermediate/csr/server.csr.pem     
DE
Berlin

mark13
the orb
localhost
localhost@mark13.org

EOF

cat<<EOF
###########################################################
# Sign Server Certificate Request with Intermediate CA
###########################################################
EOF

cat<<EOF | openssl ca -config intermediate.cnf -extensions v3_intermediate_ca \
      -passin "pass:$passphrase" \
      -extensions server_cert \
      -days 3650 -notext -md sha256 \
      -in intermediate/csr/server.csr.pem \
      -out intermediate/certs/server.cert.pem
y
y
EOF

openssl x509 -in intermediate/certs/server.cert.pem -noout -text
