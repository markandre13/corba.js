#include "test.h"
#include "test_impl.h"
#include <iostream>
#include <fstream>
#include <sstream>

using namespace std;

string lastToken;

char* GIOPTest_impl::peek() throw(::CORBA::SystemException)
{
  cout << "GIOPTest_impl::peek()" << endl;
  char *cs = CORBA::string_alloc(lastToken.size() + 1);
  strcpy(cs, lastToken.c_str());
  return cs;
}

void GIOPTest_impl::onewayMethod() throw(::CORBA::SystemException)
{
  lastToken = "onewayMethod";
}

void GIOPTest_impl::sendShort(CORBA::Short v0, CORBA::Short v1) throw(::CORBA::SystemException)
{
    std::stringstream ss;
    ss << "sendShort(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
}

void GIOPTest_impl::sendUShort(CORBA::UShort v0, CORBA::UShort v1) throw(::CORBA::SystemException)
{
    std::stringstream ss;
    ss << "sendUShort(" << v0 << "," << v1 << ")";
    lastToken = ss.str();
}

int
main(int argc, char **argv)
{
    int rc = 0;
    try {
        // init ORB and POA Manager
        CORBA::ORB_var orb = CORBA::ORB_init(argc, argv, "mico-local-orb");

//        auto *factory = new toad::RectangleFactory();
//        orb->register_value_factory("IDL:Rectangle:1.0", factory);

        CORBA::Object_var poaobj = orb->resolve_initial_references("RootPOA");
        PortableServer::POA_var poa = PortableServer::POA::_narrow( poaobj);
        PortableServer::POAManager_var mgr = poa->the_POAManager();

        // create a new instance of the servant
        GIOPTest_impl *impl = new GIOPTest_impl();
        // activate the servant
        GIOPTest_var f = impl->_this();
        // save the Interoperable Object Reference (IOR) to a file
        CORBA::String_var s = orb->object_to_string(f);
        ofstream out( "IOR.txt");
        out << s << endl;
        out.close();
        // activate POA manager
        mgr->activate();
        // run the ORB
        cout << "ORB is running..." << endl;
        orb->run();
        poa->destroy( TRUE, TRUE);
        delete impl;
        rc = 0;
    }
    catch(CORBA::SystemException_catch& ex)
    {
        ex -> _print(cerr);
        cerr << endl;
        rc = 1;
    }
    return rc;
}
