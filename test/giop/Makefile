
all: client server

# -ORBoneCallPerConnection 0 -ORBofferBiDirectionalGIOP 1

runs: server
	killall server ; ./server -ORBtraceLevel 40 -ORBmaxGIOPVersion 1.0 -ORBoneCallPerConnection 0 -ORBofferBiDirectionalGIOP 1

runc: client
	./client -ORBtraceLevel 40 -ORBmaxGIOPVersion 1.0 -ORBoneCallPerConnection 0 -ORBofferBiDirectionalGIOP 1

client: client.cc giopSK.cc giop.hh
	g++ -O0 -g -lomniORB4 -lomniDynamic4 -lomnithread -o client client.cc giopSK.cc

server: server.cc giopSK.cc giop.hh
	g++ -O0 -g -lomniORB4 -lomniDynamic4 -lomnithread -o server server.cc giopSK.cc

serverx: server.cc test.cc test_skel.cc test.h valueimpl.hh
	g++ -O0 -g -I. -Wno-deprecated -lmico2.3.13 -lpthread -ldl -o server server.cc test.cc test_skel.cc

giopSK.cc giop.hh: giop.idl
	rm -f giopSK.cc giop.hh
	omniidl -bcxx giop.idl

clean:
	rm -f giopSK.cc giop.hh