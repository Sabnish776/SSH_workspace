FROM alpine:3.19

RUN apk add --no-cache openssh bash sudo procps coreutils util-linux curl \
    && ssh-keygen -A \
    && echo 'root:rootpassword' | chpasswd \
    && adduser -D -s /bin/bash demo \
    && echo 'demo:demopassword123' | chpasswd \
    && echo 'demo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers \
    && mkdir -p /home/demo/.ssh /home/demo/workspace /home/demo/documents \
    && echo "Welcome to SSH Workspace Manager Demo Server!" > /home/demo/workspace/welcome.txt \
    && echo "System operational." > /home/demo/workspace/status.log \
    && chmod 700 /home/demo/.ssh \
    && chown -R demo:demo /home/demo

EXPOSE 22

CMD ["/usr/sbin/sshd", "-D", "-e"]
