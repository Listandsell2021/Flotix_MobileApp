import { apiClient } from './client';
import { Vehicle } from './auth';

export interface VehicleDetailsResponse {
  success: true;
  data: Vehicle;
  message: string;
}

export const vehiclesApi = {
  getVehicleDetails: async (vehicleId: string): Promise<VehicleDetailsResponse> => {
    try {
      console.log('Fetching vehicle details for ID:', vehicleId);
      
      const response = await apiClient.get<VehicleDetailsResponse>(`/api/vehicles/${vehicleId}`);
      console.log('Vehicle details response:', response.status, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Vehicle details error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        vehicleId
      });
      throw error;
    }
  },
};