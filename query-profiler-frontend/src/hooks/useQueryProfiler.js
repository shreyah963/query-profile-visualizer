import { useState, useEffect } from 'react';
import { profileTemplate, processProfileData } from '../services/profileService';

export const useQueryProfiler = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use the template data instead of making an API call
        const processedData = processProfileData(profileTemplate);
        setData(processedData);
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  return { data, isLoading, error };
};

