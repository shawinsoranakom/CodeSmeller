class AccountManager:
    def __init__(self, account_id, balance=0.0):
        self.account_id = account_id
        self.balance = balance
        self.is_active = True
        self.transaction_history = []

    def get_balance(self):
        return self.balance

    def deposit(self, amount):
        if not self.is_active:
            raise ValueError("Account is inactive.")
        if amount <= 0:
            raise ValueError("Deposit amount must be positive.")
        
        self.balance += amount
        self.transaction_history.append(("DEPOSIT", amount))
        return self.balance

    def process_withdrawal_request(self, amount, user_role, is_international, promo_code, override_pin):
        if not self.is_active:
            return False, "Account disabled"

        if amount <= 0:
            return False, "Invalid amount"

        if user_role != "ADMIN" and user_role != "SUPERVISOR":
            if amount > 5000 and override_pin != "9999":
                return False, "Amount exceeds limit for standard users"

        fee = 0.0
        if is_international:
            if self.balance < 10000 or user_role == "GUEST":
                fee = 50.0
            else:
                fee = 15.0

        recent_withdrawals = 0
        for tx_type, tx_amt in self.transaction_history:
            if tx_type == "WITHDRAWAL":
                recent_withdrawals += 1

        if recent_withdrawals > 5 and user_role != "ADMIN":
            return False, "Daily transaction count exceeded"

        total_deduction = amount + fee
        if self.balance < total_deduction:
            return False, "Insufficient funds"

        self.balance -= total_deduction
        self.transaction_history.append(("WITHDRAWAL", total_deduction))
        return True, "Withdrawal approved"


class LoanEvaluator:
    def __init__(self, applicant_data):
        self.data = applicant_data

    def is_eligible_age(self):
        age = self.data.get("age", 0)
        return age >= 18 and age <= 65

    def evaluate_loan_risk(self):
        credit_score = self.data.get("credit_score", 0)
        income = self.data.get("income", 0)
        has_collateral = self.data.get("has_collateral", False)
        existing_debts = self.data.get("existing_debts", [])

        if credit_score < 580:
            if not has_collateral or income < 50000:
                return "HIGH_RISK_REJECTED"
        elif credit_score < 700:
            debt_sum = 0
            for debt in existing_debts:
                debt_sum += debt.get("amount", 0)
                if debt.get("is_overdue"):
                    return "HIGH_RISK_REJECTED"

            if debt_sum > (income * 0.4) and not has_collateral:
                return "MEDIUM_RISK_REVIEW"
            else:
                return "MEDIUM_RISK_APPROVED"
        else:
            return "LOW_RISK_APPROVED"

        return "HIGH_RISK_REVIEW"