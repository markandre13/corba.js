#include "test.h"
#include "test_impl.h"
#include <iostream>
#include <fstream>
#include <sstream>

#define REGISTER_VALUE_TYPE(T)                          \
    struct T##_Factory : public CORBA::ValueFactoryBase \
    {                                                   \
        CORBA::ValueBase *create_for_unmarshal()        \
        {                                               \
            return new T##_impl();                      \
        }                                               \
    };                                                  \
    orb->register_value_factory("IDL:" #T ":1.0", new T##_Factory());

using namespace std;

const char *blank = "THIS PAGE INTENTIONALLY LEFT BLANK";
string lastToken(blank);

class Point_impl : virtual public OBV_Point, virtual public CORBA::DefaultValueRefCountBase
{
public:
    Point_impl() {}
    Point_impl(double x, double y)
    {
        this->x(x);
        this->y(y);
    }
};

void GIOPSmall_impl::call(const char *msg) throw(::CORBA::SystemException)
{
    cout << ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>" << endl;
    cout << "GIOPSmall::call(\"" << msg << "\")";
}

int main(int argc, char **argv)
{
    CORBA::ORB_var orb = CORBA::ORB_init(argc, argv);

    CORBA::Object_ptr poaobj = orb->resolve_initial_references("RootPOA");
    PortableServer::POA_ptr poa = PortableServer::POA::_narrow(poaobj);
    // PortableServer::POAManager_var poa_manager = poa->the_POAManager();

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

    // CORBA::Object_var polobj = orb->resolve_initial_references("PolicyCurrent");
    // CORBA::PolicyCurrent_var cur = CORBA::PolicyCurrent::_narrow(polobj);
    // CORBA::Any allow_reuse;
    // allow_reuse <<= BiDirPolicy::BOTH;
    // CORBA::PolicyList policies(1);
    // policies.length(1);
    // policies[0] = orb->create_policy(BiDirPolicy::BIDIRECTIONAL_POLICY_TYPE, allow_reuse);
    // cur->set_policy_overrides(policies, CORBA::ADD_OVERRIDE);

    // PortableServer::POA_var child_poa = poa->create_POA("childPOA", poa_manager.in(), policies);

    // Creation of childPOA is over. Destroy the Policy objects.
    for (CORBA::ULong i = 0; i < policies.length(); ++i)
    {
        policies[i]->destroy();
    }

    // poa_manager->activate();

    ifstream in("IOR.txt");
    char s[1000];
    in >> s;
    in.close();
    CORBA::Object_var obj = orb->string_to_object(s);
    GIOPTest_var server = GIOPTest::_narrow(obj);
    cout << "got Server object" << endl;

    // server->sendBool(false, true);

    GIOPSmall_impl *impl = new GIOPSmall_impl();
    poa->activate_object(impl);
    // activate the servant
    GIOPSmall_var small = impl->_this();

    cout << ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>" << endl;
    server->sendObject(small, "foo");
    return 0;
}

// FROM https://cpp.hotexamples.com/de/examples/corba/ORB_var/perform_work/cpp-orb_var-perform_work-method-examples.html
// int main(int argc, char **argv)
// {
//     try
//     {
//         CORBA::ORB_var orb = CORBA::ORB_init(argc, argv);

//         CORBA::Object_var poa_object = orb->resolve_initial_references("RootPOA");

//         if (CORBA::is_nil(poa_object.in())) {
//             fprintf(stderr, "Unable to initialize the POA.\n");
//             return 1;
//         }

//         PortableServer::POA_var root_poa = PortableServer::POA::_narrow(poa_object.in());

//         PortableServer::POAManager_var poa_manager = root_poa->the_POAManager();

//         // Policies for the childPOA to be created.
//         CORBA::PolicyList policies;
//         policies.length(1);

//         CORBA::Any pol;
//         pol <<= BiDirPolicy::BOTH;
//         policies[0] = orb->create_policy(BiDirPolicy::BIDIRECTIONAL_POLICY_TYPE, pol);

//         // obtain ORB's policy manager object
//         CORBA::Object_var obj2 = orb->resolve_initial_references("ORBPolicyManager");
//         CORBA::PolicyManager_var pmgr = CORBA::PolicyManager::_narrow(obj2);
//         assert(!CORBA::is_nil(pmgr));

//         // set policy list on the manager
//         pmgr->set_policy_overrides(policies, CORBA::SET_OVERRIDE);

//         // Create POA as child of RootPOA with the above policies.  This POA
//         // will receive request in the same connection in which it sent
//         // the request
//         cerr << "[1]" << endl;
//         PortableServer::POA_var child_poa = root_poa->create_POA("childPOA", poa_manager.in(), policies);
//         cerr << "[2]" << endl;

//         // Creation of childPOA is over. Destroy the Policy objects.
//         for (CORBA::ULong i = 0; i < policies.length(); ++i) {
//             policies[i]->destroy();
//         }

//         poa_manager->activate();

//         GIOPSmall_impl server_impl;

//         PortableServer::ObjectId_var id = PortableServer::string_to_ObjectId("simple_server");

//         child_poa->activate_object_with_id(id.in(), &server_impl);

//         CORBA::Object_var obj = child_poa->id_to_reference(id.in());

//         CORBA::String_var ior = orb->object_to_string(obj.in());
//         // ACE_DEBUG((LM_DEBUG, "Activated as <%C>\n", ior.in()));

//         // // If the ior_output_file exists, output the ior to it
//         // if (ior_output_file != 0)
//         // {
//         //     FILE *output_file = ACE_OS::fopen(ior_output_file, "w");
//         //     if (output_file == 0)
//         //         ACE_ERROR_RETURN((LM_ERROR, "Cannot open output file for writing IOR: %s", ior_output_file), 1);
//         //     ACE_OS::fprintf(output_file, "%s", ior.in());
//         //     ACE_OS::fclose(output_file);
//         // }

//         // int retval = 0;
//         // while (retval == 0)
//         // {
//         //     // Just process one upcall. We know that we would get the
//         //     // clients IOR in that call.
//         //     CORBA::Boolean pending = orb->work_pending();

//         //     if (pending)
//         //     {
//         //         orb->perform_work();
//         //     }

//         //     // Now that hopefully we have the clients IOR, just start
//         //     // making remote calls to the client.
//         //     retval = server_impl.call_client();
//         // }
//         // ACE_DEBUG((LM_DEBUG, "event loop finished\n"));

//         root_poa->destroy(1, 1);
//     }
//     catch (const CORBA::Exception &ex)
//     {
//         cerr << "--------------------------------------------" << endl;
//         ex._print(cerr);
//         ex._print_stack_trace(cerr);
//         return 1;
//     }

//     return 0;
// }