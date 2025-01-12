# Make sure mkcert is installed
# https://web.dev/articles/how-to-use-local-https
while true; do
    if ! command -v mkcert &> /dev/null; then

        # If brew is installed, prompt the user.
        if command -v brew &> /dev/null; then
            read -p "It looks like you don't have mkcert installed. Install it with brew? (y/N)" -r
            echo ""

            if [[ $REPLY =~ ^[Yy]$ ]]; then
                if ! ( brew install mkcert ) then
                    echo ""; echo ""
                    continue
                fi
            else
                read -p "Alright then. Please install mkcert and hit enter to continue." -r
                echo ""; echo ""
                continue;
            fi

        # Otherwise, just instruct them to install it themselves.
        else
            read -p "It looks like you don't have mkcert installed. Please install it and hit enter to continue." -r
            echo ""; echo ""
            continue;
        fi

    fi
    break
done

# Generate local root cert
mkcert -install

# Generate wildcard cert for local development
mkcert -cert-file secrets/localhost-cert.pem -key-file secrets/localhost-key.pem "localhost"

# Display ending message.
echo '

Your development environment is set up
'
