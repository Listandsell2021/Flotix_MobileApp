import React, { createContext, useContext, useReducer, ReactNode } from "react";
import { Expense } from "../api/expenses";

interface ExpenseFormState {
  type: "Fuel" | "Misc";
  receiptUrl?: string;
  amountFinal: number;
  amountExtracted?: number;
  currency: string;
  date: string;
  category?: string;
  notes?: string;
  merchant?: string;
  odometerReading?: number;
  isOCRProcessed: boolean;
}

interface ExpenseState {
  expenses: Expense[];
  currentForm: ExpenseFormState;
  isLoading: boolean;
  error: string | null;
}

type ExpenseAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_EXPENSES"; payload: Expense[] }
  | { type: "ADD_EXPENSE"; payload: Expense }
  | { type: "UPDATE_EXPENSE"; payload: Expense }
  | { type: "DELETE_EXPENSE"; payload: string }
  | { type: "UPDATE_FORM"; payload: Partial<ExpenseFormState> }
  | { type: "RESET_FORM" }
  | {
      type: "SET_OCR_RESULT";
      payload: { amountExtracted: number; amountFinal: number };
    };

const getCurrentDate = () => {
  const date = new Date();
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const initialFormState: ExpenseFormState = {
  type: "Fuel",
  amountFinal: 0,
  currency: "EUR",
  date: getCurrentDate(),
  isOCRProcessed: false,
};

const initialState: ExpenseState = {
  expenses: [],
  currentForm: initialFormState,
  isLoading: false,
  error: null,
};

const expenseReducer = (
  state: ExpenseState,
  action: ExpenseAction
): ExpenseState => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false };
    case "SET_EXPENSES":
      return { ...state, expenses: action.payload, isLoading: false };
    case "ADD_EXPENSE":
      return { ...state, expenses: [action.payload, ...state.expenses] };
    case "UPDATE_EXPENSE":
      return {
        ...state,
        expenses: state.expenses.map((expense) =>
          expense.id === action.payload.id ? action.payload : expense
        ),
      };
    case "DELETE_EXPENSE":
      return {
        ...state,
        expenses: state.expenses.filter(
          (expense) => expense.id !== action.payload
        ),
      };
    case "UPDATE_FORM":
      return {
        ...state,
        currentForm: { ...state.currentForm, ...action.payload },
      };
    case "RESET_FORM":
      return {
        ...state,
        currentForm: { ...initialFormState, date: getCurrentDate() },
      };
    case "SET_OCR_RESULT":
      return {
        ...state,
        currentForm: {
          ...state.currentForm,
          amountExtracted: action.payload.amountExtracted,
          amountFinal: action.payload.amountFinal,
          isOCRProcessed: true,
        },
      };
    default:
      return state;
  }
};

interface ExpenseContextType {
  state: ExpenseState;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setExpenses: (expenses: Expense[]) => void;
  addExpense: (expense: Expense) => void;
  updateExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  updateForm: (updates: Partial<ExpenseFormState>) => void;
  resetForm: () => void;
  setOCRResult: (amountExtracted: number, amountFinal: number) => void;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const ExpenseProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(expenseReducer, initialState);

  const setLoading = (loading: boolean) => {
    dispatch({ type: "SET_LOADING", payload: loading });
  };

  const setError = (error: string | null) => {
    dispatch({ type: "SET_ERROR", payload: error });
  };

  const setExpenses = (expenses: Expense[]) => {
    dispatch({ type: "SET_EXPENSES", payload: expenses });
  };

  const addExpense = (expense: Expense) => {
    dispatch({ type: "ADD_EXPENSE", payload: expense });
  };

  const updateExpense = (expense: Expense) => {
    dispatch({ type: "UPDATE_EXPENSE", payload: expense });
  };

  const deleteExpense = (id: string) => {
    dispatch({ type: "DELETE_EXPENSE", payload: id });
  };

  const updateForm = (updates: Partial<ExpenseFormState>) => {
    dispatch({ type: "UPDATE_FORM", payload: updates });
  };

  const resetForm = () => {
    dispatch({ type: "RESET_FORM" });
  };

  const setOCRResult = (amountExtracted: number, amountFinal: number) => {
    dispatch({
      type: "SET_OCR_RESULT",
      payload: { amountExtracted, amountFinal },
    });
  };

  return (
    <ExpenseContext.Provider
      value={{
        state,
        setLoading,
        setError,
        setExpenses,
        addExpense,
        updateExpense,
        deleteExpense,
        updateForm,
        resetForm,
        setOCRResult,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpense = () => {
  const context = useContext(ExpenseContext);
  if (context === undefined) {
    throw new Error("useExpense must be used within an ExpenseProvider");
  }
  return context;
};
