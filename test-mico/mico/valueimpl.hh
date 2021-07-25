#include "test.h"
#include <string.h>
#include <stdio.h>

using namespace std;

class Point_impl: virtual public OBV_Point, virtual public CORBA::DefaultValueRefCountBase {
  public:
    Point_impl() {}
    Point_impl(double x, double y) {
      this->x(x);
      this->y(y);
    }
};

namespace space {
  class Box_impl: virtual public ::OBV_space::Box, virtual public ::CORBA::DefaultValueRefCountBase {
    public:
      Box_impl() {}
      Box_impl(Point *p0, Point *p1) {
        this->p0(p0);
        this->p1(p1);
      }
  };
}

class Size_impl: virtual public OBV_Size, virtual public CORBA::DefaultValueRefCountBase {
  public:
    Size_impl() {}
    Size_impl(double width, double height) {
      this->width(width);
      this->height(height);
    }
};

class Figure_impl: virtual public OBV_Figure, virtual public CORBA::DefaultValueRefCountBase {
  public:
    Figure_impl() {}
    Figure_impl(unsigned long id) {
      this->id(id);
    }
    char* toString() {
      static char buffer[256];
      snprintf(buffer, sizeof(buffer), "Figure(id=%lu)", id());
      return buffer;
    }
};

class Connection_impl: virtual public OBV_Connection, virtual public CORBA::DefaultValueRefCountBase {
  public:
    Connection_impl() {}
    Connection_impl(unsigned long id, Figure *start, Figure *end) {
      this->id(id);
      this->start(start);
      this->end(end);
    }
    char* toString() {
      static char buffer[256];
      snprintf(buffer, sizeof(buffer), "Connection(id=%lu, start=%lu, end=%lu)", id(), start()->id(), end()->id());
      return buffer;
    }
};

class Drawing_impl: virtual public OBV_Drawing, virtual public CORBA::DefaultValueRefCountBase {
  public:
    Drawing_impl() {}
};
