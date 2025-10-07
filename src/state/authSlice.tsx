import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User, DriverData } from "../api/auth";

interface AuthState {
  user: User | null;
  driverData: DriverData | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

type AuthAction =
  | { type: "SET_LOADING"; payload: boolean }
  | {
      type: "SET_AUTHENTICATED";
      payload: {
        user: User;
        driverData: DriverData | null;
        accessToken: string;
        refreshToken: string;
      };
    }
  | { type: "SET_LOGOUT" }
  | { type: "SET_USER"; payload: User };

const initialState: AuthState = {
  user: null,
  driverData: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  isAuthenticated: false,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_AUTHENTICATED":
      return {
        ...state,
        user: action.payload.user,
        driverData: action.payload.driverData,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      };
    case "SET_LOGOUT":
      return {
        ...initialState,
        isLoading: false,
      };
    case "SET_USER":
      return {
        ...state,
        user: action.payload,
      };
    default:
      return state;
  }
};

interface AuthContextType {
  state: AuthState;
  login: (
    user: User,
    driverData: DriverData | null,
    accessToken: string,
    refreshToken: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  isVehicle: boolean;
  setIsVehicle: Function;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const [isVehicle, setIsVehicle] = useState<boolean>(false);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const [accessToken, refreshToken, userString, driverDataString] =
        await AsyncStorage.multiGet([
          "accessToken",
          "refreshToken",
          "user",
          "driverData",
        ]);

      if (accessToken[1] && refreshToken[1] && userString[1]) {
        const user = JSON.parse(userString[1]);
        const driverData = driverDataString[1]
          ? JSON.parse(driverDataString[1])
          : null;
        dispatch({
          type: "SET_AUTHENTICATED",
          payload: {
            user,
            driverData,
            accessToken: accessToken[1],
            refreshToken: refreshToken[1],
          },
        });
      } else {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    } catch (error) {
      console.error("Error checking auth state:", error);
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const login = async (
    user: User,
    driverData: DriverData | null,
    accessToken: string,
    refreshToken: string
  ) => {
    try {
      const storageItems: [string, string][] = [
        ["accessToken", accessToken],
        ["refreshToken", refreshToken],
        ["user", JSON.stringify(user)],
      ];

      // Only store driverData if it exists
      if (driverData) {
        storageItems.push(["driverData", JSON.stringify(driverData)]);
      }

      await AsyncStorage.multiSet(storageItems);

      dispatch({
        type: "SET_AUTHENTICATED",
        payload: { user, driverData, accessToken, refreshToken },
      });
    } catch (error) {
      console.error("Error storing auth data:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove([
        "accessToken",
        "refreshToken",
        "user",
        "driverData",
      ]);
      dispatch({ type: "SET_LOGOUT" });
    } catch (error) {
      console.error("Error clearing auth data:", error);
      throw error;
    }
  };

  const updateUser = (user: User) => {
    dispatch({ type: "SET_USER", payload: user });
  };

  return (
    <AuthContext.Provider
      value={{ state, login, logout, updateUser, isVehicle, setIsVehicle }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
