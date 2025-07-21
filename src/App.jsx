import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { IoPersonSharp } from "react-icons/io5";
import { saveAs } from "file-saver";
import { Toaster, toast } from "react-hot-toast";

export default function App() {
  const [date, setDate] = useState("");
  const [fileName, setFileName] = useState("No file selected");
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeStatus, setActiveStatus] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [originalFile, setOriginalFile] = useState(null);
  const fileInputRef = useRef(null);
  const [showLoadButton, setShowLoadButton] = useState(false);
  const [val, setval] = useState('Updated')

  useEffect(() => {
    setShowLoadButton(date && originalFile);
  }, [date, originalFile]);

  const resetFileState = () => {
    setFileName("No file selected");
    setOriginalFile(null);
    setStudents([]);
    setAttendanceData({});
    setShowLoadButton(false);
    setDate("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    setval(file.name)
    if (file) {
      setFileName(file.name);
      setOriginalFile(file);
      toast.success(`File "${file.name}" selected! Click "Load Data" to process.`);
    }
  };

  const loadData = async () => {
    if (!date || !originalFile) return;

    setIsLoading(true);
    const toastId = toast.loading("Loading student data...");

    try {
      await readExcelFile(originalFile);
      toast.success("Student data loaded successfully!", { id: toastId });
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error loading student data.", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const readExcelFile = async (file) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const existingAttendance = {};
      if (date && jsonData.length > 0 && jsonData[0][date]) {
        jsonData.forEach(row => {
          const roll = row["rollno"] || row['Roll No'] || row["Roll"] || row["ID"];
          if (roll) {
            existingAttendance[roll] = row[date];
          }
        });
      }

      const studentData = jsonData.map((row, index) => {
        const roll = row["rollno"] || row['Roll No'] || row["Roll"] || row["ID"] || `temp-${index + 1}`;
        return {
          roll: roll,
          name: row["name"] || row['Name'] || row["Student Name"] || `Student ${index + 1}`,
          avatar: <IoPersonSharp className="text-blue-600" />,
          course: row["Course"] || row["department"] || "N/A",
          semester: row["semester"] || row['Semester'] || row["Sem"] || "N/A",
          status: existingAttendance[roll] || "A" // Default to Absent if no data exists
        };
      });

      setStudents(studentData);

      const initialAttendanceData = {};
      studentData.forEach(student => {
        initialAttendanceData[student.roll] = student.status;
      });
      setAttendanceData(initialAttendanceData);
    } catch (error) {
      console.error("Error reading Excel file:", error);
      toast.error("Error reading the Excel file. Please check the format.");
      throw error; // Re-throw to handle in loadData
    }
  };

  const markAttendance = (roll, status) => {
    if (!date) {
      toast.error("Please select a date first.");
      return;
    }

    setActiveStatus(`${roll}-${status}`);
    setAttendanceData(prev => ({
      ...prev,
      [roll]: status
    }));

    const row = document.getElementById(`row-${roll}`);
    row.classList.add(status === "P" ? "bg-green-100" : "bg-red-100");

    toast.success(`Marked ${status === "P" ? "Present" : "Absent"} for ${students.find(s => s.roll === roll)?.name}`);

    setTimeout(() => {
      row.classList.remove(status === "P" ? "bg-green-100" : "bg-red-100");
    }, 1000);
  };

  const saveAttendance = async () => {
    if (!date) {
      toast.error("Please select a date first.");
      return;
    }

    if (students.length === 0) {
      toast.error("No student data loaded. Please upload an Excel file first.");
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading("Saving attendance data...");

    try {
      let workbook;
      let worksheet;

      if (originalFile) {
        const data = await originalFile.arrayBuffer();
        workbook = XLSX.read(data);
        worksheet = workbook.Sheets[workbook.SheetNames[0]];
      } else {
        workbook = XLSX.utils.book_new();
        const wsData = students.map(student => ({
          "Roll No": student.roll,
          "Name": student.name,
          "Course": student.course,
          "Semester": student.semester,
          [date]: attendanceData[student.roll] || "A"
        }));
        worksheet = XLSX.utils.json_to_sheet(wsData);
        XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      jsonData.forEach(row => {
        const roll = row["rollno"] || row['Roll No'] || row["Roll"] || row["ID"];
        if (roll && attendanceData[roll]) {
          row[date] = attendanceData[roll];
        }
      });

      const updatedWorksheet = XLSX.utils.json_to_sheet(jsonData);
      workbook.Sheets[workbook.SheetNames[0]] = updatedWorksheet;

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      saveAs(blob, `${val}`);

      toast.success("Attendance saved successfully!", { id: toastId });
      resetFileState(); 
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Error saving attendance data.", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.roll.toString().includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#fff',
            color: '#374151',
            border: '1px solid #e5e7eb'
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff'
            }
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff'
            }
          }
        }}
      />

      <div className="max-w-6xl mx-auto bg-white shadow-md p-6 border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              <span className="text-blue-600">
                Attendance Tracker
              </span>
            </h1>
            <p className="text-gray-600">Mark and manage student attendance records</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-1 min-w-[180px]">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-700 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder-gray-500"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => fileInputRef.current.click()}
                className={`w-full bg-white border ${originalFile ? 'border-green-500' : 'border-gray-300'} text-gray-700 px-4 py-2 hover:bg-gray-50 transition flex items-center justify-between`}
              >
                <span className={`truncate max-w-[120px] ${originalFile ? 'text-green-600' : 'text-gray-700'}`}>
                  {fileName}
                </span>
                <svg className={`w-5 h-5 ml-2 ${originalFile ? 'text-green-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".xlsx,.xls,.csv"
              />
            </div>

            {showLoadButton && (
              <button
                onClick={loadData}
                disabled={isLoading}
                className={`px-4 py-2 text-sm font-medium transition-all flex items-center justify-center ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </>
                ) : (
                  <>
                    <svg className="-ml-1 mr-2 h-4 w-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Load Data
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-300 text-gray-700 px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder-gray-500"
            />
            <svg
              className="absolute left-3 top-3 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        <div className="overflow-hidden border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-4 px-6 text-left text-xs font-semibold text-blue-600 uppercase tracking-wider">
                  Student
                </th>
                <th scope="col" className="py-4 px-6 text-left text-xs font-semibold text-blue-600 uppercase tracking-wider">
                  Details
                </th>
                <th scope="col" className="py-4 px-6 text-center text-xs font-semibold text-blue-600 uppercase tracking-wider">
                  Mark Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr
                    key={student.roll}
                    id={`row-${student.roll}`}
                    className={`transition duration-150 ${attendanceData[student.roll] === "P" ? 'bg-green-50' : attendanceData[student.roll] === "A" ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="py-5 px-6 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-10 w-10 border flex items-center justify-center text-xl ${attendanceData[student.roll] === "P" ? 'bg-green-100 border-green-300' : attendanceData[student.roll] === "A" ? 'bg-red-100 border-red-300' : 'bg-blue-50 border-blue-200'}`}>
                          {student.avatar}
                        </div>
                        <div className="ml-4">
                          <div className="text-lg font-medium text-gray-900">{student.name}</div>
                          <div className={`text-sm ${attendanceData[student.roll] === "P" ? 'text-green-600' : attendanceData[student.roll] === "A" ? 'text-red-600' : 'text-blue-600'}`}>
                            {student.roll}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6 whitespace-nowrap">
                      <div className="text-base text-gray-700">{student.course}</div>
                      <div className="text-sm text-gray-500">Semester {student.semester}</div>
                    </td>
                    <td className="py-5 px-6 whitespace-nowrap text-center">
                      <div className="flex justify-center space-x-3">
                        <button
                          disabled={!date || students.length === 0}
                          onClick={() => markAttendance(student.roll, "P")}
                          className={`inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium transition-all ${!date || students.length === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : activeStatus === `${student.roll}-P` ? 'bg-green-600 text-white' : attendanceData[student.roll] === "P" ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200' : 'bg-white text-green-700 hover:bg-green-50 border border-gray-300'}`}
                        >
                          {activeStatus === `${student.roll}-P` ? (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          Present
                        </button>
                        <button
                          disabled={!date || students.length === 0}
                          onClick={() => markAttendance(student.roll, "A")}
                          className={`inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium transition-all ${!date || students.length === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : activeStatus === `${student.roll}-A` ? 'bg-red-600 text-white' : attendanceData[student.roll] === "A" ? 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200' : 'bg-white text-red-700 hover:bg-red-50 border border-gray-300'}`}
                        >
                          {activeStatus === `${student.roll}-A` ? (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          Absent
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="py-10 text-center">
                    <div className="text-gray-500 flex flex-col items-center">
                      <svg className="h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {students.length === 0 ? "Upload an Excel file and click 'Load Data' to load student data" : "No students found matching your search"}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 border-t border-gray-200 pt-4">
          <div className="mb-2 sm:mb-0">
            Showing <span className="font-medium text-blue-600">{filteredStudents.length}</span> of <span className="font-medium text-blue-600">{students.length}</span> students
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={saveAttendance}
              disabled={!date || students.length === 0 || isLoading}
              className={`px-4 py-2 text-sm font-medium transition-all flex items-center ${!date || students.length === 0 || isLoading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="-ml-1 mr-2 h-4 w-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save Attendance
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}