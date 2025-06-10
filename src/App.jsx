import React, { useState, useReducer, useContext, useMemo, useCallback, useRef, useEffect } from 'react';
import { PlusCircle, Trash2, FileDown, FileUp, GripVertical, HelpCircle, ChevronsUpDown, AlertTriangle, Printer, FileSpreadsheet } from 'lucide-react';
// import jsPDF from 'jspdf'; // Removed to fix build error
// import html2canvas from 'html2canvas'; // Removed to fix build error

// --- UTILITY ---
// This utility function helps in conditionally applying Tailwind CSS classes.
function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}

// --- INITIAL STATE & DATA STRUCTURE ---
const initialState = {
    clientName: '',
    projectName: 'New Project Estimation',
    milestones: [
        {
            id: 'A',
            name: 'Milestone A',
            isEnabled: true,
            tasks: [],
        }
    ],
    remarks: '## General Remarks\n\n- This section uses Markdown for formatting.\n- Notes here are for internal reference and will not be included in any exports.'
};

// --- CONTEXT & REDUCER for STATE MANAGEMENT ---
const ProjectContext = React.createContext();

function projectReducer(state, action) {
    switch (action.type) {
        // Project Info
        case 'SET_PROJECT_INFO':
            return { ...state, [action.payload.field]: action.payload.value };
        
        // Load State from imported JSON
        case 'LOAD_STATE':
            return { ...action.payload };
            
        // Milestone Actions
        case 'ADD_MILESTONE': {
            const nextLetter = String.fromCharCode(65 + state.milestones.length);
            const newMilestone = {
                id: nextLetter,
                name: `Milestone ${nextLetter}`,
                isEnabled: true,
                tasks: []
            };
            return { ...state, milestones: [...state.milestones, newMilestone] };
        }
        case 'UPDATE_MILESTONE': {
            return {
                ...state,
                milestones: state.milestones.map(m => 
                    m.id === action.payload.id ? { ...m, [action.payload.field]: action.payload.value } : m
                )
            };
        }
        case 'DELETE_MILESTONE': {
            const updatedMilestones = state.milestones.filter(m => m.id !== action.payload.id);
            // Re-assign IDs (A, B, C...)
            const finalMilestones = updatedMilestones.map((milestone, index) => {
                const newId = String.fromCharCode(65 + index);
                return {
                    ...milestone,
                    id: newId,
                    tasks: milestone.tasks.map((task, taskIndex) => ({
                        ...task,
                        id: `${newId}${taskIndex + 1}`
                    }))
                };
            });
            return { ...state, milestones: finalMilestones };
        }
        
        // Task Actions
        case 'ADD_TASK': {
            const { milestoneId } = action.payload;
            return {
                ...state,
                milestones: state.milestones.map(m => {
                    if (m.id === milestoneId) {
                        const newTaskId = `${m.id}${m.tasks.length + 1}`;
                        const newTask = {
                            id: newTaskId,
                            name: 'New Task',
                            description: '',
                            estimates: { optimistic: 0, mostLikely: 0, pessimistic: 0 },
                            tests: '',
                            definitionOfDone: '',
                            qAndA: [],
                            isEnabled: true,
                        };
                        return { ...m, tasks: [...m.tasks, newTask] };
                    }
                    return m;
                })
            };
        }
        case 'UPDATE_TASK': {
            const { milestoneId, taskId, field, value } = action.payload;
            return {
                ...state,
                milestones: state.milestones.map(m => {
                    if (m.id === milestoneId) {
                        return {
                            ...m,
                            tasks: m.tasks.map(t => {
                                if (t.id === taskId) {
                                    if (field.startsWith('estimates.')) {
                                        const estimateField = field.split('.')[1];
                                        return { ...t, estimates: { ...t.estimates, [estimateField]: value } };
                                    }
                                    return { ...t, [field]: value };
                                }
                                return t;
                            })
                        };
                    }
                    return m;
                })
            };
        }
        case 'DELETE_TASK': {
            const { milestoneId, taskId } = action.payload;
            let newState = {
                ...state,
                milestones: state.milestones.map(m => {
                    if (m.id === milestoneId) {
                        return { ...m, tasks: m.tasks.filter(t => t.id !== taskId) };
                    }
                    return m;
                })
            };
             // Re-ID tasks within the affected milestone
            newState.milestones = newState.milestones.map(m => {
                if (m.id === milestoneId) {
                    return { ...m, tasks: m.tasks.map((task, index) => ({...task, id: `${m.id}${index+1}`}))};
                }
                return m;
            });
            return newState;
        }
        case 'MOVE_TASK': {
            const { sourceMilestoneId, destMilestoneId, taskId } = action.payload;
            if (sourceMilestoneId === destMilestoneId) return state;

            let taskToMove;
            const sourceMilestone = state.milestones.find(m => m.id === sourceMilestoneId);
            if(sourceMilestone) {
                taskToMove = sourceMilestone.tasks.find(t => t.id === taskId);
            }
            if (!taskToMove) return state;

            let newState = { ...state };

            // Remove from source
            newState.milestones = newState.milestones.map(m => {
                if (m.id === sourceMilestoneId) {
                    return { ...m, tasks: m.tasks.filter(t => t.id !== taskId) };
                }
                return m;
            });
             // Re-ID tasks in source milestone
            newState.milestones = newState.milestones.map(m => {
                if (m.id === sourceMilestoneId) {
                    return { ...m, tasks: m.tasks.map((t, index) => ({...t, id: `${m.id}${index + 1}`}))};
                }
                return m;
            });

            // Add to destination and re-ID
            newState.milestones = newState.milestones.map(m => {
                if (m.id === destMilestoneId) {
                    const newTasks = [...m.tasks, taskToMove];
                    return { ...m, tasks: newTasks.map((t, index) => ({...t, id: `${m.id}${index + 1}`}))};
                }
                return m;
            });

            return newState;
        }

        // Q&A Actions
        case 'ADD_Q_AND_A': {
             const { milestoneId, taskId } = action.payload;
             return {
                ...state,
                milestones: state.milestones.map(m => {
                    if (m.id === milestoneId) {
                        return {
                            ...m,
                            tasks: m.tasks.map(t => {
                                if (t.id === taskId) {
                                    const newQandA = [...t.qAndA, { question: '', answer: '' }];
                                    return { ...t, qAndA: newQandA };
                                }
                                return t;
                            })
                        };
                    }
                    return m;
                })
            };
        }

        case 'UPDATE_Q_AND_A': {
            const { milestoneId, taskId, index, field, value } = action.payload;
            return {
                ...state,
                milestones: state.milestones.map(m => {
                    if (m.id === milestoneId) {
                        return {
                            ...m,
                            tasks: m.tasks.map(t => {
                                if (t.id === taskId) {
                                     const updatedQandA = t.qAndA.map((item, i) => i === index ? {...item, [field]: value } : item);
                                     return { ...t, qAndA: updatedQandA };
                                }
                                return t;
                            })
                        };
                    }
                    return m;
                })
            };
        }

        case 'DELETE_Q_AND_A': {
             const { milestoneId, taskId, index } = action.payload;
             return {
                ...state,
                milestones: state.milestones.map(m => {
                    if (m.id === milestoneId) {
                        return {
                            ...m,
                            tasks: m.tasks.map(t => {
                                if (t.id === taskId) {
                                     const filteredQandA = t.qAndA.filter((_, i) => i !== index);
                                     return { ...t, qAndA: filteredQandA };
                                }
                                return t;
                            })
                        };
                    }
                    return m;
                })
            };
        }

        // Remarks
        case 'UPDATE_REMARKS':
            return { ...state, remarks: action.payload };

        default:
            return state;
    }
}

// --- CALCULATION UTILS ---
const CalculationUtils = {
    getExpectedTime: (o, m, p) => (o + 4 * m + p) / 6,
    getStandardDeviation: (o, p) => (p - o) / 6,
    formatHours: (hours) => {
        if (isNaN(hours) || hours === null) return '0.00';
        return hours.toFixed(2);
    },
};

// --- SHADCN UI COMPONENT DEFINITIONS ---
// These are simplified versions of shadcn/ui components.
// Normally, you would have these in separate files.

const Label = ({ children, ...props }) => (
    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" {...props}>
        {children}
    </label>
);

const Input = React.forwardRef(({ className, ...props }, ref) => (
    <input
        className={cn(
            "flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
        )}
        ref={ref}
        {...props}
    />
));

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
    <textarea
        className={cn(
            "flex min-h-[80px] w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
        )}
        ref={ref}
        {...props}
    />
));

const Button = React.forwardRef(({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variants = {
        default: "bg-slate-900 text-white hover:bg-slate-800",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        outline: "border border-slate-300 bg-transparent hover:bg-slate-100",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
        ghost: "hover:bg-slate-100",
        link: "text-slate-900 underline-offset-4 hover:underline",
    };
    const sizes = {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
    };
    return (
        <button
            className={cn("inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
                variants[variant],
                sizes[size],
                className
            )}
            ref={ref}
            {...props}
        />
    );
});


const Card = ({ className, ...props }) => (
    <div className={cn("rounded-lg border bg-white text-slate-900 shadow-sm", className)} {...props} />
);

const CardHeader = ({ className, ...props }) => (
    <div className={cn("flex flex-col space-y-1.5 p-4", className)} {...props} />
);

const CardTitle = ({ className, ...props }) => (
    <h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
);

const CardDescription = ({ className, ...props }) => (
    <p className={cn("text-sm text-slate-500", className)} {...props} />
);

const CardContent = ({ className, ...props }) => (
    <div className={cn("p-4 pt-0", className)} {...props} />
);

const CardFooter = ({ className, ...props }) => (
    <div className={cn("flex items-center p-4 pt-0", className)} {...props} />
);

const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <div className="inline-flex items-center">
    <input
      type="checkbox"
      className="sr-only"
      ref={ref}
      {...props}
    />
    <div
      onClick={() => props.onChange && props.onChange({ target: { checked: !props.checked } })}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2",
        props.checked ? 'bg-slate-900' : 'bg-slate-200',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          props.checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </div>
  </div>
));

const TabsContext = React.createContext();

const Tabs = ({ defaultValue, children }) => {
    const [activeTab, setActiveTab] = useState(defaultValue);
    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab }}>
            <div>{children}</div>
        </TabsContext.Provider>
    );
};

const TabsList = ({ children, className }) => (
    <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500", className)}>
        {children}
    </div>
);

const TabsTrigger = ({ value, children, className }) => {
    const { activeTab, setActiveTab } = useContext(TabsContext);
    const isActive = activeTab === value;
    return (
        <button
            onClick={() => setActiveTab(value)}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive ? "bg-white text-slate-900 shadow-sm" : "hover:bg-white/50",
                className
            )}
        >
            {children}
        </button>
    );
};

const TabsContent = ({ value, children, className }) => {
    const { activeTab } = useContext(TabsContext);
    return activeTab === value ? <div className={cn("mt-4", className)}>{children}</div> : null;
};

const AccordionContext = React.createContext();

const Accordion = ({ children, type="single", collapsible=true }) => {
    const [openItem, setOpenItem] = useState(null);

    const toggleItem = (value) => {
        if(collapsible){
            setOpenItem(openItem === value ? null : value);
        } else {
            setOpenItem(value);
        }
    };
    
    return (
        <AccordionContext.Provider value={{ openItem, toggleItem }}>
            <div className="w-full">{children}</div>
        </AccordionContext.Provider>
    );
};

const AccordionItem = ({ value, children, className }) => (
     <div className={cn("border-b", className)}>{React.Children.map(children, child => React.cloneElement(child, { itemValue: value }))}</div>
);

const AccordionTrigger = ({ children, itemValue, className }) => {
    const { openItem, toggleItem } = useContext(AccordionContext);
    return (
        <button onClick={() => toggleItem(itemValue)} className={cn("flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180", className)}>
            {children}
            <ChevronsUpDown className="h-4 w-4 shrink-0 transition-transform duration-200" data-state={openItem === itemValue ? 'open' : 'closed'}/>
        </button>
    );
};

const AccordionContent = ({ children, itemValue, className }) => {
    const { openItem } = useContext(AccordionContext);
    return openItem === itemValue ? <div className={cn("overflow-hidden text-sm transition-all pb-4", className)}>{children}</div> : null;
};

const Tooltip = ({ content, children }) => (
    <div className="relative flex flex-col items-center group">
        {children}
        <div className="absolute bottom-0 flex-col items-center hidden mb-6 group-hover:flex">
            <span className="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap bg-black shadow-lg rounded-md">{content}</span>
            <div className="w-3 h-3 -mt-2 rotate-45 bg-black"></div>
        </div>
    </div>
);

const Separator = ({ className }) => (
    <div className={cn("shrink-0 bg-slate-200 h-[1px] w-full", className)} />
);


// --- APP COMPONENTS ---

function ProjectHeader() {
    const { state, dispatch } = useContext(ProjectContext);
    const fileInputRef = useRef(null);
    const [pdfScriptsLoaded, setPdfScriptsLoaded] = useState(false);

    // Effect to load external scripts for PDF generation
    useEffect(() => {
        const loadScript = (src) => {
            return new Promise((resolve, reject) => {
                // Check if script already exists and if the library is on window
                if (document.querySelector(`script[src="${src}"]`)) {
                    // A simple check to see if the lib is available.
                    // This could be improved for more robust checking.
                    const libName = src.includes('jspdf') ? 'jspdf' : 'html2canvas';
                    if (window[libName]) {
                        resolve();
                        return;
                    }
                    // If script tag exists but lib not on window, wait for it to load
                    const interval = setInterval(() => {
                        if (window[libName]) {
                            clearInterval(interval);
                            resolve();
                        }
                    }, 100);
                    return;
                }
                const script = document.createElement('script');
                script.src = src;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error(`Script load error for ${src}`));
                document.body.appendChild(script);
            });
        };

        // Check if libraries are already on window object from a previous load
        if (window.jspdf && window.html2canvas) {
            setPdfScriptsLoaded(true);
        } else {
            Promise.all([
                loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
                loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
            ]).then(() => {
                // Wait a brief moment to ensure libraries are globally available
                 setTimeout(() => {
                    if (window.jspdf && window.html2canvas) {
                        setPdfScriptsLoaded(true);
                    }
                 }, 100);
            }).catch(error => {
                console.error("Failed to load PDF scripts:", error);
                alert("Could not load scripts required for PDF export. Please check your internet connection and try again.");
            });
        }
    }, []);

    const handleExport = () => {
        const dataStr = JSON.stringify(state, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'pert-estimation.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const handleImportClick = () => {
        fileInputRef.current.click();
    };


    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedState = JSON.parse(e.target.result);
                // Basic validation
                if (importedState.milestones && importedState.projectName) {
                    dispatch({ type: 'LOAD_STATE', payload: importedState });
                } else {
                    alert('Invalid JSON file format.');
                }
            } catch (error) {
                console.error("Failed to parse JSON", error);
                alert('Error reading or parsing the file.');
            }
        };
        reader.readAsText(file);
        event.target.value = null; // Reset input for re-upload
    };

    const handlePdfExport = () => {
        if (!pdfScriptsLoaded || !window.jspdf || !window.html2canvas) {
            alert('PDF generation libraries are still loading. Please wait a moment and try again.');
            console.error('jsPDF or html2canvas not found on window object.');
            return;
        }

        const estimationElement = document.getElementById('estimation-content-for-export');
        const introElement = document.getElementById('pdf-intro');
        const { jsPDF } = window.jspdf;
        const html2canvas = window.html2canvas;

        if (!estimationElement || !introElement) {
            alert('Could not find content to export.');
            return;
        }

        const projectTitle = `${state.clientName} - ${state.projectName}`;
        
        html2canvas(introElement, {scale: 2}).then(introCanvas => {
            html2canvas(estimationElement, { scale: 2 }).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const introImgData = introCanvas.toDataURL('image/png');

                const pdf = new jsPDF({
                    orientation: 'p',
                    unit: 'mm',
                    format: 'a4'
                });

                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                
                // Add Header
                pdf.setFontSize(18);
                pdf.text(projectTitle, pdfWidth / 2, 20, { align: 'center' });
                pdf.setFontSize(10);
                pdf.text(`Exported on: ${new Date().toLocaleDateString()}`, pdfWidth / 2, 28, { align: 'center' });

                // Add Intro Image
                const introImgProps = pdf.getImageProperties(introImgData);
                const introImgHeight = (introImgProps.height * pdfWidth) / introImgProps.width;
                pdf.addImage(introImgData, 'PNG', 0, 40, pdfWidth, introImgHeight);

                pdf.addPage();
                
                // Add Estimation Image
                const imgProps = pdf.getImageProperties(imgData);
                const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

                let heightLeft = imgHeight;
                let position = 0;

                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;

                while (heightLeft > 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }
                
                pdf.save(`${projectTitle.replace(/ /g, '_')}_PERT_Estimation.pdf`);
            });
        });
    };
    
    const handleCsvExport = () => {
        const { clientName, projectName, milestones } = state;
        let csvContent = "Subject,Description,Target version,Estimated time\n";

        milestones.forEach(milestone => {
            if (milestone.isEnabled) {
                milestone.tasks.forEach(task => {
                    if (task.isEnabled) {
                         const onePointEst = CalculationUtils.formatHours(CalculationUtils.getExpectedTime(task.estimates.optimistic, task.estimates.mostLikely, task.estimates.pessimistic));
                         
                        const descriptionParts = [
                            task.description,
                            task.tests ? `Tests:\n${task.tests}` : '',
                            task.definitionOfDone ? `Definition of Done:\n${task.definitionOfDone}` : ''
                        ].filter(Boolean).join('\n\n');

                        const row = [
                            `"${task.name.replace(/"/g, '""')}"`,
                            `"${descriptionParts.replace(/"/g, '""')}"`,
                            `"${milestone.name.replace(/"/g, '""')}"`,
                            onePointEst
                        ].join(',');
                        
                        csvContent += row + "\n";
                    }
                });
            }
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${projectName}_Redmine_Import.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <header className="p-4 bg-slate-50 border-b">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex-grow min-w-[250px]">
                    <h1 className="text-2xl font-bold text-slate-800">PERT Estimation Tool</h1>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                     <div className="flex gap-2 items-center">
                        <Label htmlFor="clientName">Client:</Label>
                        <Input
                            id="clientName"
                            className="w-40"
                            value={state.clientName}
                            onChange={(e) => dispatch({ type: 'SET_PROJECT_INFO', payload: { field: 'clientName', value: e.target.value } })}
                            placeholder="Client Name"
                        />
                    </div>
                    <div className="flex gap-2 items-center">
                        <Label htmlFor="projectName">Project:</Label>
                        <Input
                            id="projectName"
                            className="w-40"
                            value={state.projectName}
                            onChange={(e) => dispatch({ type: 'SET_PROJECT_INFO', payload: { field: 'projectName', value: e.target.value } })}
                            placeholder="Project Name"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".json"
                        onChange={handleFileChange}
                    />
                    <Button variant="outline" size="sm" onClick={handleImportClick}>
                        <FileUp className="mr-2 h-4 w-4" /> Import JSON
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <FileDown className="mr-2 h-4 w-4" /> Export JSON
                    </Button>
                     <Button variant="outline" size="sm" onClick={handleCsvExport}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                    <Button variant="default" size="sm" onClick={handlePdfExport} disabled={!pdfScriptsLoaded}>
                        <Printer className="mr-2 h-4 w-4" />
                        {pdfScriptsLoaded ? 'Export PDF' : 'Loading...'}
                    </Button>
                </div>
            </div>
        </header>
    );
}

function Task({ milestone, task }) {
    const { dispatch } = useContext(ProjectContext);
    const [isDragging, setIsDragging] = useState(false);

    const handleTaskChange = (field, value) => {
        dispatch({ type: 'UPDATE_TASK', payload: { milestoneId: milestone.id, taskId: task.id, field, value } });
    };
    
     const handleEstimateChange = (field, value) => {
        const numValue = value === '' ? '' : parseFloat(value);
        if (value === '' || (!isNaN(numValue) && numValue >= 0)) {
           dispatch({ type: 'UPDATE_TASK', payload: { milestoneId: milestone.id, taskId: task.id, field: `estimates.${field}`, value: numValue === '' ? 0 : numValue } });
        }
    };
    
    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete task "${task.name}"?`)) {
            dispatch({ type: 'DELETE_TASK', payload: { milestoneId: milestone.id, taskId: task.id } });
        }
    };

    const expected = useMemo(() => CalculationUtils.getExpectedTime(task.estimates.optimistic, task.estimates.mostLikely, task.estimates.pessimistic), [task.estimates]);
    const stdDev = useMemo(() => CalculationUtils.getStandardDeviation(task.estimates.optimistic, task.estimates.pessimistic), [task.estimates]);
    
    const onDragStart = (e) => {
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.setData('sourceMilestoneId', milestone.id);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => setIsDragging(true), 0);
    };

    const onDragEnd = () => setIsDragging(false);

    return (
        <Card className={cn(
            "mb-4 relative",
            !task.isEnabled && "opacity-50 bg-slate-50",
            isDragging && "opacity-30 border-dashed"
        )}
        draggable={!task.name.startsWith('Project Management')}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        >
             {!task.name.startsWith('Project Management') && (
                <div className="absolute top-1/2 -left-3 -translate-y-1/2 cursor-grab text-slate-400 hover:text-slate-600">
                    <GripVertical />
                </div>
            )}
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                   <div className="flex items-center gap-3 flex-grow">
                     <span className="font-mono text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">{task.id}</span>
                     <Input 
                        value={task.name} 
                        onChange={(e) => handleTaskChange('name', e.target.value)} 
                        className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
                        readOnly={task.name.startsWith('Project Management')}
                     />
                   </div>
                   <div className="flex items-center gap-3">
                     <Switch 
                        checked={task.isEnabled} 
                        onChange={(e) => handleTaskChange('isEnabled', e.target.checked)} 
                     />
                     {!task.name.startsWith('Project Management') && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-500" onClick={handleDelete}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                     )}
                   </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                   {/* Left Column */}
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor={`desc-${task.id}`}>Description</Label>
                            <Textarea 
                                id={`desc-${task.id}`} 
                                value={task.description}
                                onChange={e => handleTaskChange('description', e.target.value)}
                                placeholder="What needs to be done?"
                                readOnly={task.name.startsWith('Project Management')}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor={`opt-${task.id}`}>Optimistic (O)</Label>
                                <Input type="number" id={`opt-${task.id}`} value={task.estimates.optimistic} onChange={e => handleEstimateChange('optimistic', e.target.value)} min="0" readOnly={task.name.startsWith('Project Management')} />
                            </div>
                            <div>
                                <Label htmlFor={`most-${task.id}`}>Most Likely (M)</Label>
                                <Input type="number" id={`most-${task.id}`} value={task.estimates.mostLikely} onChange={e => handleEstimateChange('mostLikely', e.target.value)} min="0" readOnly={task.name.startsWith('Project Management')} />
                            </div>
                            <div>
                                <Label htmlFor={`pess-${task.id}`}>Pessimistic (P)</Label>
                                <Input type="number" id={`pess-${task.id}`} value={task.estimates.pessimistic} onChange={e => handleEstimateChange('pessimistic', e.target.value)} min="0" readOnly={task.name.startsWith('Project Management')} />
                            </div>
                        </div>
                        <div>
                            <div className="p-3 bg-slate-50 rounded-md border text-sm">
                               <div className="flex justify-between items-center font-semibold">
                                 <span>One-point Estimate (E)</span>
                                 <span className="font-mono text-base">{CalculationUtils.formatHours(expected)}h</span>
                               </div>
                               <Separator className="my-2" />
                               <div className="text-slate-600 space-y-1">
                                    <div className="flex justify-between"><span>± 1σ (68% conf.)</span> <span>{CalculationUtils.formatHours(expected - stdDev)}h – {CalculationUtils.formatHours(expected + stdDev)}h</span></div>
                                    <div className="flex justify-between"><span>± 2σ (95% conf.)</span> <span>{CalculationUtils.formatHours(expected - 2*stdDev)}h – {CalculationUtils.formatHours(expected + 2*stdDev)}h</span></div>
                                    <div className="flex justify-between"><span>± 3σ (99% conf.)</span> <span>{CalculationUtils.formatHours(expected - 3*stdDev)}h – {CalculationUtils.formatHours(expected + 3*stdDev)}h</span></div>
                               </div>
                            </div>
                        </div>
                    </div>
                    {/* Right Column */}
                     <div className="space-y-4">
                        <div>
                            <Label htmlFor={`tests-${task.id}`}>Tests (Optional)</Label>
                            <Textarea id={`tests-${task.id}`} value={task.tests} onChange={e => handleTaskChange('tests', e.target.value)} placeholder="How will this be tested?" />
                        </div>
                         <div>
                            <Label htmlFor={`dod-${task.id}`}>Definition of Done (DoD) (Optional)</Label>
                            <Textarea id={`dod-${task.id}`} value={task.definitionOfDone} onChange={e => handleTaskChange('definitionOfDone', e.target.value)} placeholder="What are the completion criteria?" />
                        </div>
                        {!task.name.startsWith('Project Management') && (
                            <div>
                                <QAndASection milestoneId={milestone.id} task={task} />
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function QAndASection({ milestoneId, task }) {
    const { dispatch } = useContext(ProjectContext);

    const handleAdd = () => dispatch({ type: 'ADD_Q_AND_A', payload: { milestoneId, taskId: task.id } });
    const handleUpdate = (index, field, value) => dispatch({ type: 'UPDATE_Q_AND_A', payload: { milestoneId, taskId: task.id, index, field, value } });
    const handleDelete = (index) => dispatch({ type: 'DELETE_Q_AND_A', payload: { milestoneId, taskId: task.id, index } });

    return (
        <Accordion type="single" collapsible>
            <AccordionItem value="q-and-a">
                <AccordionTrigger>Q&A (Internal only)</AccordionTrigger>
                <AccordionContent>
                    <div className="space-y-4">
                        {task.qAndA && task.qAndA.map((item, index) => (
                            <div key={index} className="p-3 border rounded-md space-y-2 relative">
                                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => handleDelete(index)}><Trash2 className="h-4 w-4" /></Button>
                                <Input 
                                    placeholder="Question..." 
                                    value={item.question} 
                                    onChange={(e) => handleUpdate(index, 'question', e.target.value)}
                                    className="font-semibold"
                                />
                                <Textarea 
                                    placeholder="Answer..." 
                                    value={item.answer}
                                    onChange={(e) => handleUpdate(index, 'answer', e.target.value)} 
                                />
                            </div>
                        ))}
                         <Button variant="outline" size="sm" onClick={handleAdd}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Q&A
                        </Button>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}

function Milestone({ milestone }) {
    const { dispatch } = useContext(ProjectContext);
    const [isOver, setIsOver] = useState(false);

    const handleMilestoneChange = (field, value) => {
        dispatch({ type: 'UPDATE_MILESTONE', payload: { id: milestone.id, field, value } });
    };

    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete milestone "${milestone.name}" and all its tasks?`)) {
            dispatch({ type: 'DELETE_MILESTONE', payload: { id: milestone.id } });
        }
    };
    
    const handleAddTask = () => {
        dispatch({ type: 'ADD_TASK', payload: { milestoneId: milestone.id } });
    };
    
    const milestoneTotals = useMemo(() => {
        const enabledTasks = milestone.tasks.filter(t => t.isEnabled);
        const expectedSum = enabledTasks.reduce((sum, task) => {
            const { optimistic, mostLikely, pessimistic } = task.estimates;
            return sum + CalculationUtils.getExpectedTime(optimistic, mostLikely, pessimistic);
        }, 0);
        return { expectedSum };
    }, [milestone.tasks]);
    
    const managementTask = useMemo(() => {
        const otherTasksSum = milestone.tasks
            .filter(t => t.isEnabled && !t.name.startsWith('Project Management'))
            .reduce((sum, t) => sum + CalculationUtils.getExpectedTime(t.estimates.optimistic, t.estimates.mostLikely, t.estimates.pessimistic), 0);
        
        const roundedSum = Math.ceil(otherTasksSum);

        return {
            id: `${milestone.id}-mgmt`,
            name: 'Project Management (10%, 15%, 20%)',
            description: 'Auto-estimated based on the sum of other tasks. Includes project management, meetings, communication, and delivery orchestration.',
            estimates: {
                optimistic: roundedSum * 0.10,
                mostLikely: roundedSum * 0.15,
                pessimistic: roundedSum * 0.20,
            },
            isEnabled: true, // This task is always enabled if milestone is enabled
        };
    }, [milestone.tasks]);

    const tasksWithMgmt = [...milestone.tasks, managementTask];

    const onDragOver = (e) => {
        e.preventDefault();
        setIsOver(true);
    };

    const onDragLeave = (e) => {
        setIsOver(false);
    };

    const onDrop = (e) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        const sourceMilestoneId = e.dataTransfer.getData('sourceMilestoneId');
        dispatch({type: 'MOVE_TASK', payload: { taskId, sourceMilestoneId, destMilestoneId: milestone.id }});
        setIsOver(false);
    };

    return (
        <Card 
            className={cn(
                "mb-8 transition-all",
                !milestone.isEnabled && "bg-slate-100",
                isOver && "border-2 border-blue-500 border-dashed"
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <CardHeader className={cn("bg-slate-50 rounded-t-lg", !milestone.isEnabled && "bg-slate-200")}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-grow">
                        <span className="font-mono text-xl text-slate-600 bg-white px-3 py-1 rounded-md border">{milestone.id}</span>
                         <Input 
                            value={milestone.name} 
                            onChange={(e) => handleMilestoneChange('name', e.target.value)} 
                            className="text-xl font-bold border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent"
                         />
                    </div>
                    <div className="flex items-center gap-4">
                         <div className="flex items-center gap-2">
                            <Label htmlFor={`switch-${milestone.id}`}>Enabled</Label>
                            <Switch 
                                id={`switch-${milestone.id}`}
                                checked={milestone.isEnabled} 
                                onChange={(e) => handleMilestoneChange('isEnabled', e.target.checked)} 
                            />
                         </div>
                        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-500" onClick={handleDelete}>
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className={cn("p-6", !milestone.isEnabled && "opacity-50 pointer-events-none")}>
                {tasksWithMgmt.map(task => (
                    <Task key={task.id} milestone={milestone} task={task} />
                ))}
                
                <div className="flex items-center justify-between mt-6">
                    <Button variant="secondary" onClick={handleAddTask}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Task
                    </Button>
                    <div className="text-right">
                        <div className="text-sm text-slate-500">Milestone Total (E)</div>
                        <div className="text-2xl font-bold text-slate-800">{CalculationUtils.formatHours(milestoneTotals.expectedSum)}h</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function EstimationTab() {
    const { state, dispatch } = useContext(ProjectContext);

    const handleAddMilestone = () => {
        dispatch({ type: 'ADD_MILESTONE' });
    };
    
    const globalTotal = useMemo(() => {
        return state.milestones.reduce((total, milestone) => {
            if (!milestone.isEnabled) return total;
            
             const milestoneSum = milestone.tasks.reduce((milestoneTotal, task) => {
                if (!task.isEnabled) return milestoneTotal;
                return milestoneTotal + CalculationUtils.getExpectedTime(task.estimates.optimistic, task.estimates.mostLikely, task.estimates.pessimistic);
            }, 0);

            return total + milestoneSum;

        }, 0);
    }, [state.milestones]);

    return (
        <div id="estimation-content">
            {state.milestones.map(milestone => (
                <Milestone key={milestone.id} milestone={milestone} />
            ))}
             <div className="mt-8 flex items-center justify-between">
                <Button onClick={handleAddMilestone}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Milestone
                </Button>

                <Card className="min-w-[250px]">
                    <CardHeader>
                        <CardTitle>Project Grand Total</CardTitle>
                        <CardDescription>Sum of all enabled milestone estimates.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold text-right text-blue-600">
                            {CalculationUtils.formatHours(globalTotal)}h
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function RemarksTab() {
    const { state, dispatch } = useContext(ProjectContext);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Remarks</CardTitle>
                <CardDescription>Internal notes and observations. This section is not included in any exports.</CardDescription>
            </CardHeader>
            <CardContent>
                <Textarea 
                    className="min-h-[400px] font-mono"
                    value={state.remarks}
                    onChange={(e) => dispatch({ type: 'UPDATE_REMARKS', payload: e.target.value })}
                />
            </CardContent>
        </Card>
    );
}

function PdfExportContent({ state }) {
    const { clientName, projectName, milestones } = state;

    const globalTotal = useMemo(() => {
         return milestones.reduce((total, milestone) => {
            if (!milestone.isEnabled) return total;
             const milestoneSum = milestone.tasks.reduce((milestoneTotal, task) => {
                if (!task.isEnabled) return milestoneTotal;
                return milestoneTotal + CalculationUtils.getExpectedTime(task.estimates.optimistic, task.estimates.mostLikely, task.estimates.pessimistic);
            }, 0);
            return total + milestoneSum;
        }, 0);
    }, [milestones]);

    return (
        <>
        <div id="pdf-intro" className="p-8 bg-white text-black">
            <h2 className="text-2xl font-bold mb-4">PERT Estimation Explained</h2>
            <p className="mb-2 text-sm">The Program Evaluation and Review Technique (PERT) is a statistical tool used in project management to analyze and represent the tasks involved in completing a given project. This report provides an estimate based on three time values for each task:</p>
            <ul className="list-disc list-inside space-y-1 text-sm mb-4">
                <li><strong>Optimistic (O):</strong> The minimum possible time required to accomplish a task, assuming everything proceeds better than is normally expected.</li>
                <li><strong>Most Likely (M):</strong> The best estimate of the time required to accomplish a task, assuming everything proceeds as normal.</li>
                <li><strong>Pessimistic (P):</strong> The maximum possible time required to accomplish a task, assuming everything goes wrong (excluding major catastrophes).</li>
            </ul>
            <p className="text-sm">These values are used to calculate the <strong>Expected Time (E)</strong> using the formula: <code className="bg-gray-200 p-1 rounded">E = (O + 4M + P) / 6</code>. This weighted average provides a more realistic time estimate. The report also shows confidence intervals based on the standard deviation to indicate the range of likely outcomes.</p>
        </div>

        <div id="estimation-content-for-export" className="p-8 bg-white text-black">
            {milestones.filter(m => m.isEnabled).map(milestone => {
                const managementTask = {
                    id: `${milestone.id}-mgmt`,
                    name: 'Project Management (10%, 15%, 20%)',
                    description: 'Auto-estimated based on the sum of other tasks. Includes project management, meetings, communication, and delivery orchestration.',
                    estimates: (() => {
                         const otherTasksSum = milestone.tasks
                            .filter(t => t.isEnabled && !t.name.startsWith('Project Management'))
                            .reduce((sum, t) => sum + CalculationUtils.getExpectedTime(t.estimates.optimistic, t.estimates.mostLikely, t.estimates.pessimistic), 0);
                         const roundedSum = Math.ceil(otherTasksSum);
                         return {
                            optimistic: roundedSum * 0.10,
                            mostLikely: roundedSum * 0.15,
                            pessimistic: roundedSum * 0.20,
                         }
                    })(),
                    isEnabled: true,
                };
                const tasksToRender = [...milestone.tasks, managementTask].filter(t => t.isEnabled);

                const milestoneTotals = tasksToRender.reduce((sum, task) => {
                    const { optimistic, mostLikely, pessimistic } = task.estimates;
                    return sum + CalculationUtils.getExpectedTime(optimistic, mostLikely, pessimistic);
                }, 0);

                return (
                    <div key={milestone.id} className="mb-6 p-4 border rounded-lg break-inside-avoid">
                        <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-t-lg border-b">
                            <span className="font-mono text-lg bg-white px-2 py-1 rounded border">{milestone.id}</span>
                            <h3 className="text-xl font-bold">{milestone.name}</h3>
                        </div>
                        <div className="p-2">
                            {tasksToRender.map(task => {
                                const expected = CalculationUtils.getExpectedTime(task.estimates.optimistic, task.estimates.mostLikely, task.estimates.pessimistic);
                                return (
                                <div key={task.id} className="py-3 border-b last:border-b-0 break-inside-avoid">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1 py-0.5 rounded">{task.id}</span>
                                            <h4 className="font-semibold">{task.name}</h4>
                                        </div>
                                        <div className="font-bold text-lg">{CalculationUtils.formatHours(expected)}h</div>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-1 ml-8">{task.description}</p>
                                    {(task.tests || task.definitionOfDone) && (
                                    <div className="mt-2 ml-8 p-2 bg-gray-50 rounded text-xs border">
                                        {task.tests && <div><strong>Tests:</strong> {task.tests}</div>}
                                        {task.definitionOfDone && <div className="mt-1"><strong>DoD:</strong> {task.definitionOfDone}</div>}
                                    </div>
                                    )}
                                </div>
                                )
                            })}
                        </div>
                        <div className="text-right font-bold text-xl p-3 bg-gray-100 rounded-b-lg mt-2">
                            Milestone Total: {CalculationUtils.formatHours(milestoneTotals)}h
                        </div>
                    </div>
                )
            })}
            <div className="mt-8 p-4 text-center bg-blue-100 border-2 border-blue-500 rounded-lg">
                <div className="text-lg font-semibold text-blue-800">PROJECT GRAND TOTAL</div>
                <div className="text-4xl font-bold text-blue-700">{CalculationUtils.formatHours(globalTotal)}h</div>
            </div>
        </div>
        </>
    );
}


export default function App() {
    const [state, dispatch] = useReducer(projectReducer, initialState);
    
    return (
        <ProjectContext.Provider value={{ state, dispatch }}>
            <div className="bg-slate-100 min-h-screen font-sans text-slate-800">
                <ProjectHeader />
                <main className="p-4 md:p-8">
                    <Tabs defaultValue="estimation">
                        <TabsList>
                            <TabsTrigger value="estimation">Estimation</TabsTrigger>
                            <TabsTrigger value="remarks">Remarks</TabsTrigger>
                        </TabsList>
                        <TabsContent value="estimation">
                            <EstimationTab />
                        </TabsContent>
                        <TabsContent value="remarks">
                            <RemarksTab />
                        </TabsContent>
                    </Tabs>
                </main>
                
                {/* Hidden content for PDF export */}
                <div className="absolute -left-[9999px] top-auto w-[800px] overflow-auto">
                    <PdfExportContent state={state} />
                </div>
            </div>
        </ProjectContext.Provider>
    );
}
