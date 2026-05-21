export default function createEmployeesObject(departmentName, employees) {
  const dict = {};
  dict[departmentName] = employees;
  return dict;
}
