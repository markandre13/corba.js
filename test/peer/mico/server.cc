#include "test.h"
#include "test_impl.h"
#include <iostream>
#include <fstream>
#include <sstream>

#include <mico/security/csi_base.h>
#include <mico/security/security.h>
#include <mico/security/securitylevel1.h>
#include <mico/security/securitylevel2.h>

#define REGISTER_VALUE_TYPE(T) \
  struct T ## _Factory: public CORBA::ValueFactoryBase { \
    CORBA::ValueBase* create_for_unmarshal() { \
      return new T ## _impl(); \
    } \
  }; \
  orb->register_value_factory("IDL:" #T ":1.0", new T ## _Factory());

using namespace std;

const char * blank = "THIS PAGE INTENTIONALLY LEFT BLANK";
string lastToken(blank);

int
main(int argc, char **argv) {
    int rc = 0;
    try {
        // init ORB and POA Manager
        CORBA::ORB_var orb = CORBA::ORB_init(argc, argv);

        // https://www.novell.com/documentation/extend5/Docs/help/MP/orb/tutorial/poaBankSecure-1.htm
        auto securityCurrent = orb->resolve_initial_references("SecurityCurrent");

        CORBA::PolicyList policies;
        policies.length(1);

        CORBA::Any both;
        both <<= BiDirPolicy::BOTH;
        policies[0] = orb->create_policy(BiDirPolicy::BIDIRECTIONAL_POLICY_TYPE, both);

        // obtain ORB's policy manager object
        CORBA::Object_var obj2 = orb->resolve_initial_references("ORBPolicyManager");
        CORBA::PolicyManager_var pmgr = CORBA::PolicyManager::_narrow(obj2);
        assert(!CORBA::is_nil(pmgr));

        // set policy list on the manager
        pmgr->set_policy_overrides(policies, CORBA::SET_OVERRIDE);

        CORBA::Object_var poaobj = orb->resolve_initial_references("RootPOA");
        PortableServer::POA_var poa = PortableServer::POA::_narrow( poaobj);
        PortableServer::POAManager_var mgr = poa->the_POAManager();

        // create a new instance of the servant
        LoginTest_impl *impl = new LoginTest_impl();
        // activate the servant
        LoginTest_var f = impl->_this();
        // save the Interoperable Object Reference (IOR) to a file
        CORBA::String_var s = orb->object_to_string(f);
        ofstream out("IOR.txt");
        out << s << endl;
        out.close();
        // activate POA manager
        mgr->activate();
        // run the ORB
        cout << "ORB is running..." << endl;
        orb->run();
        poa->destroy(TRUE, TRUE);
        delete impl;
        rc = 0;
    }
    catch(CORBA::SystemException_catch& ex) {
        ex->_print(cerr);
        cerr << endl;
        rc = 1;
    }
    return rc;
}

char* LoginTest_impl::peek() throw(::CORBA::SystemException)
{
    cout << "LoginTest_impl::peek() " << lastToken << endl;
    return CORBA::string_dup(lastToken.c_str());
}

void LoginTest_impl::sendString(const char * v0) throw(::CORBA::SystemException) {
    std::stringstream ss;
    ss << "sendString(\"" << v0 << "\")";
    lastToken = ss.str();
    cout << lastToken << endl;
}
