#! /bin/bash

set -eou pipefail

cat <<EOF
   ____     ____    U  ___ u   U  ___ u__     __ U _____ u   ____     _   _    U  ___ u__   __ 
U /"___|uU |  _"\ u  \/"_ \/    \/"_ \/\ \   /"/u\| ___"|/U | __")uU |"|u| |    \/"_ \/\ \ / / 
\| |  _ / \| |_) |/  | | | |    | | | | \ \ / //  |  _|"   \|  _ \/ \| |\| |    | | | | \ V /  
 | |_| |   |  _ <.-,_| |_| |.-,_| |_| | /\ V /_,-.| |___    | |_) |  | |_| |.-,_| |_| |U_|"|_u 
  \____|   |_| \_\\_)-\___/  \_)-\___/ U  \_/-(_/ |_____|   |____/  <<\___/  \_)-\___/   |_|   
  _)(|_    //   \\_    \\         \\     //       <<   >>  _|| \\_ (__) )(        \\ .-,//|(_  
 (__)__)  (__)  (__)  (__)       (__)   (__)     (__) (__)(__) (__)    (__)      (__) \_) (__)



EOF

read -r -p "Enter server name [Development at Localhost Buoy]: " server_name
read -r -p "Enter buoy host [localhost:8000]: " server_host

printf "Creating env config..."

BUOY_ID="$(uuidgen -r)"
BUOY_HOST=${server_host:-"localhost:8000"}
SSL_ENABLED=0
BUOY_NAME=${server_name:-"Development at Localhost Buoy"}
JWT_SECRET="$(openssl rand -base64 32)"

cat <<EOF > .env
BUOY_ID="${BUOY_ID}"
BUOY_HOST="${BUOY_HOST}"
SSL_ENABLED=${SSL_ENABLED}
BUOY_NAME="${BUOY_NAME}"
JWT_SECRET="${JWT_SECRET}"
EOF

printf "done.\\n"

printf "Installing groovebuoy..."
yarn install

cat <<EOF

!!! Groovebuoy installed !!!

To start your bouy, please run:

    $ yarn start

EOF