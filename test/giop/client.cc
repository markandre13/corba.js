#include "test.h"
#include "test_impl.h"
#include <iostream>
#include <fstream>
#include <sstream>

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

class Point_impl: virtual public OBV_Point, virtual public CORBA::DefaultValueRefCountBase {
  public:
    Point_impl() {}
    Point_impl(double x, double y) {
      this->x(x);
      this->y(y);
    }
};

void GIOPSmall_impl::call(const char * msg) throw(::CORBA::SystemException) {
    cout << ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>" << endl;
    cout << "GIOPSmall::call(\"" << msg << "\")";
}

int
main(int argc, char **argv) {
    CORBA::ORB_var orb = CORBA::ORB_init(argc, argv);

    CORBA::Object_ptr poaobj = orb->resolve_initial_references("RootPOA");
    PortableServer::POA_ptr poa = PortableServer::POA::_narrow(poaobj);
    PortableServer::POAManager_var poa_manager = poa->the_POAManager ();

    CORBA::Object_var polobj = orb->resolve_initial_references("PolicyCurrent");
    CORBA::PolicyCurrent_var cur = CORBA::PolicyCurrent::_narrow(polobj);
    CORBA::Any allow_reuse;
    allow_reuse <<= BiDirPolicy::BOTH;
    CORBA::PolicyList pl(1);
    pl.length(1);
    pl[0] = orb->create_policy(BiDirPolicy::BIDIRECTIONAL_POLICY_TYPE, allow_reuse);
    cur->set_policy_overrides(pl, CORBA::ADD_OVERRIDE);

    PortableServer::POA_var child_poa = poa->create_POA ("childPOA", poa_manager.in(), policies);

    // Creation of childPOA is over. Destroy the Policy objects.
    for (CORBA::ULong i = 0; i < policies.length (); ++i) {
        policies[i]->destroy ();
    }

    poa_manager->activate ();

    ifstream in( "IOR.txt");
    char s[1000];
    in >> s;
    in.close(); 
    CORBA::Object_var obj = orb->string_to_object(s);
    GIOPTest_var server = GIOPTest::_narrow(obj);
    cout << "got Server object" << endl;

    // server->sendBool(false, true);

    GIOPSmall_impl *impl = new GIOPSmall_impl();
    child_poa->activate_object(impl);
    // activate the servant
    GIOPSmall_var small = impl->_this();
    
    cout << ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>" << endl;
    server->sendObject(small, "foo");
}
