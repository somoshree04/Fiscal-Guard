from ml_logic.data_conv import prepare_data
from ml_logic.model import train_isolation_forest

if __name__ == "__main__":
    data, _ = prepare_data("data.csv")
    print(train_isolation_forest(data))