PWD=`pwd`
MICO_DIR=$(PWD)/../mico

all: client server

runs: server
	killall server && ./server -ORBIIOPAddr inet:192.168.1.105:9000

runs-debug: server
	./server -ORBIIOPAddr inet:192.168.1.105:9000 -ORBDebug All

runc: client
	LD_LIBRARY_PATH=$(MICO_DIR)/libs ./client

client: client.cc test.cc test_skel.cc test.h valueimpl.hh
	g++ -O0 -g -I. -Wno-deprecated -lmico2.3.13 -lpthread -ldl -o client client.cc test.cc test_skel.cc

server: server.cc test.cc test_skel.cc test.h valueimpl.hh
	g++ -O0 -g -I. -Wno-deprecated -lmico2.3.13 -lpthread -ldl -o server server.cc test.cc test_skel.cc

test.h test.cc test_impl.cc test_impl.h test_skel.cc: test.idl
	rm -f test.h test.cc test_impl.cc test_impl.h test_skel.cc
	idl --c++-skel --c++-impl test.idl

clean:
	rm -f test.h test.cc test_impl.cc test_impl.h test_skel.cc